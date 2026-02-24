import 'server-only';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';

const allocationAmountSchema = z.number().positive();

export const installmentAllocationInputSchema = z.object({
    gl_account_id: z.string().uuid(),
    cost_center_id: z.string().uuid().nullable().optional(),
    amount: allocationAmountSchema
});

export type InstallmentAllocationInput = z.infer<typeof installmentAllocationInputSchema>;

const centsTolerance = 0.01;

function toCents(value: number): number {
    return Math.round(value * 100);
}

export function assertAllocationTotal(
    installmentAmount: number,
    allocations: InstallmentAllocationInput[]
): void {
    if (allocations.length === 0) {
        throw new Error('Rateio contábil não informado');
    }

    const totalAmount = allocations.reduce((sum, current) => sum + current.amount, 0);
    const diff = Math.abs(totalAmount - installmentAmount);
    if (diff > centsTolerance) {
        throw new Error(
            `Soma do rateio (${totalAmount.toFixed(2)}) difere do valor da parcela (${installmentAmount.toFixed(2)})`
        );
    }
}

export function assertAllocationTotalInCents(
    installmentAmountCents: number,
    allocations: InstallmentAllocationInput[]
): void {
    const allocationsCents = allocations.reduce((sum, current) => sum + toCents(current.amount), 0);
    if (allocationsCents !== installmentAmountCents) {
        throw new Error(
            `Soma do rateio em centavos (${allocationsCents}) difere da parcela (${installmentAmountCents})`
        );
    }
}

export async function replaceArInstallmentAllocations(params: {
    companyId: string;
    installmentId: string;
    installmentAmount: number;
    allocations: InstallmentAllocationInput[];
}): Promise<void> {
    const parsed = z.object({
        companyId: z.string().uuid(),
        installmentId: z.string().uuid(),
        installmentAmount: z.number().positive(),
        allocations: z.array(installmentAllocationInputSchema).min(1)
    }).parse(params);

    assertAllocationTotal(parsed.installmentAmount, parsed.allocations);

    const supabase = await createAdminClient();
    const payload = parsed.allocations.map((allocation) => ({
        gl_account_id: allocation.gl_account_id,
        cost_center_id: allocation.cost_center_id ?? null,
        amount: allocation.amount
    }));

    const { error } = await supabase.rpc('set_ar_installment_allocations', {
        p_installment_id: parsed.installmentId,
        p_allocations: payload
    });

    if (error) {
        throw new Error(`Falha ao salvar rateios AR: ${error.message}`);
    }
}

export async function replaceApInstallmentAllocations(params: {
    companyId: string;
    installmentId: string;
    installmentAmount: number;
    allocations: InstallmentAllocationInput[];
}): Promise<void> {
    const parsed = z.object({
        companyId: z.string().uuid(),
        installmentId: z.string().uuid(),
        installmentAmount: z.number().positive(),
        allocations: z.array(installmentAllocationInputSchema).min(1)
    }).parse(params);

    assertAllocationTotal(parsed.installmentAmount, parsed.allocations);

    const supabase = await createAdminClient();
    const payload = parsed.allocations.map((allocation) => ({
        gl_account_id: allocation.gl_account_id,
        cost_center_id: allocation.cost_center_id ?? null,
        amount: allocation.amount
    }));

    const { error } = await supabase.rpc('set_ap_installment_allocations', {
        p_installment_id: parsed.installmentId,
        p_allocations: payload
    });

    if (error) {
        throw new Error(`Falha ao salvar rateios AP: ${error.message}`);
    }
}

export interface InstallmentAllocationView {
    installment_id: string;
    gl_account_id: string;
    gl_account_code: string;
    gl_account_name: string;
    cost_center_id: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
    amount: number;
}

function extractRelationObject(
    value: unknown
): { code: string | null; name: string | null } | null {
    if (!value) return null;
    if (Array.isArray(value)) {
        const first = value[0];
        if (!first || typeof first !== 'object') return null;
        const parsed = z.object({
            code: z.string().nullable().optional(),
            name: z.string().nullable().optional()
        }).safeParse(first);
        if (!parsed.success) return null;
        return {
            code: parsed.data.code ?? null,
            name: parsed.data.name ?? null
        };
    }

    if (typeof value !== 'object') return null;
    const parsed = z.object({
        code: z.string().nullable().optional(),
        name: z.string().nullable().optional()
    }).safeParse(value);
    if (!parsed.success) return null;
    return {
        code: parsed.data.code ?? null,
        name: parsed.data.name ?? null
    };
}

export async function listArAllocationsByTitle(
    titleId: string
): Promise<Record<string, InstallmentAllocationView[]>> {
    const supabase = await createAdminClient();

    const { data: installments, error: installmentsError } = await supabase
        .from('ar_installments')
        .select('id')
        .eq('ar_title_id', titleId);

    if (installmentsError) {
        logger.error('[listArAllocationsByTitle] Installments Error', { titleId, message: installmentsError.message });
        throw new Error(installmentsError.message);
    }

    const installmentIds = (installments ?? []).map((row) => row.id);
    if (installmentIds.length === 0) {
        return {};
    }

    const { data, error } = await supabase
        .from('ar_installment_allocations')
        .select(`
            amount,
            ar_installment_id,
            gl_account_id,
            cost_center_id,
            gl_account:gl_accounts!gl_account_id(code,name),
            cost_center:cost_centers!cost_center_id(code,name)
        `)
        .in('ar_installment_id', installmentIds);

    if (error) {
        logger.error('[listArAllocationsByTitle] Error', { titleId, message: error.message });
        throw new Error(error.message);
    }

    const rows = z.array(
        z.object({
            amount: z.coerce.number(),
            ar_installment_id: z.string().uuid(),
            gl_account_id: z.string().uuid(),
            cost_center_id: z.string().uuid().nullable(),
            gl_account: z.unknown().optional(),
            cost_center: z.unknown().optional()
        })
    ).parse(data ?? []);

    return rows.reduce<Record<string, InstallmentAllocationView[]>>((acc, row) => {
        const key = row.ar_installment_id;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push({
            installment_id: row.ar_installment_id,
            gl_account_id: row.gl_account_id,
            gl_account_code: extractRelationObject(row.gl_account)?.code ?? '',
            gl_account_name: extractRelationObject(row.gl_account)?.name ?? '',
            cost_center_id: row.cost_center_id,
            cost_center_code: extractRelationObject(row.cost_center)?.code ?? null,
            cost_center_name: extractRelationObject(row.cost_center)?.name ?? null,
            amount: row.amount
        });
        return acc;
    }, {});
}

export async function listApAllocationsByTitle(
    titleId: string
): Promise<Record<string, InstallmentAllocationView[]>> {
    const supabase = await createAdminClient();

    const { data: installments, error: installmentsError } = await supabase
        .from('ap_installments')
        .select('id')
        .eq('ap_title_id', titleId);

    if (installmentsError) {
        logger.error('[listApAllocationsByTitle] Installments Error', { titleId, message: installmentsError.message });
        throw new Error(installmentsError.message);
    }

    const installmentIds = (installments ?? []).map((row) => row.id);
    if (installmentIds.length === 0) {
        return {};
    }

    const { data, error } = await supabase
        .from('ap_installment_allocations')
        .select(`
            amount,
            ap_installment_id,
            gl_account_id,
            cost_center_id,
            gl_account:gl_accounts!gl_account_id(code,name),
            cost_center:cost_centers!cost_center_id(code,name)
        `)
        .in('ap_installment_id', installmentIds);

    if (error) {
        logger.error('[listApAllocationsByTitle] Error', { titleId, message: error.message });
        throw new Error(error.message);
    }

    const rows = z.array(
        z.object({
            amount: z.coerce.number(),
            ap_installment_id: z.string().uuid(),
            gl_account_id: z.string().uuid(),
            cost_center_id: z.string().uuid().nullable(),
            gl_account: z.unknown().optional(),
            cost_center: z.unknown().optional()
        })
    ).parse(data ?? []);

    return rows.reduce<Record<string, InstallmentAllocationView[]>>((acc, row) => {
        const key = row.ap_installment_id;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push({
            installment_id: row.ap_installment_id,
            gl_account_id: row.gl_account_id,
            gl_account_code: extractRelationObject(row.gl_account)?.code ?? '',
            gl_account_name: extractRelationObject(row.gl_account)?.name ?? '',
            cost_center_id: row.cost_center_id,
            cost_center_code: extractRelationObject(row.cost_center)?.code ?? null,
            cost_center_name: extractRelationObject(row.cost_center)?.name ?? null,
            amount: row.amount
        });
        return acc;
    }, {});
}
