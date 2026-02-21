import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Define types locally since codegen hasn't run yet
export interface GLAccount {
    id: string;
    company_id: string;
    code: string;
    name: string;
    type: 'SINTETICA' | 'ANALITICA';
    nature: 'RECEITA' | 'DEDUCAO' | 'CUSTO' | 'DESPESA' | 'FINANCEIRO';
    parent_id: string | null;
    is_active: boolean;
    is_system_locked: boolean;
    origin: 'SYSTEM' | 'PRODUCT_CATEGORY' | 'MANUAL';
    origin_id: string | null;
    created_at: string;
    updated_at: string;
    children?: GLAccount[];
}

export interface RevenueCategory {
    id: string;
    name: string;
    normalized_name: string;
    revenue_account_id: string;
    is_active: boolean;
    usage_count?: number; // Calculated field
    account_code?: string; // Joined field
}

// Schemas
export const createCategorySchema = z.object({
    name: z.string().min(3, "Nome muito curto").max(100, "Nome muito longo"),
});

export const updateCategorySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(3, "Nome muito curto").max(100, "Nome muito longo"),
});

const createRevenueCategoryRpcSchema = z.object({
    category_id: z.string().uuid(),
    category_name: z.string(),
    account_id: z.string().uuid(),
    account_code: z.string(),
    is_active: z.boolean(),
});

async function getCurrentCompanyId(supabase: SupabaseClient): Promise<string> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { data: member, error: memberError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .limit(1)
        .maybeSingle();

    if (memberError) throw new Error(`Erro ao resolver empresa ativa: ${memberError.message}`);
    if (!member?.company_id) throw new Error('Usuário sem empresa vinculada.');

    return member.company_id;
}

// --- Server Actions ---

export async function getAccountsTree() {
    const supabase = await createClient();

    const fetchAccounts = async () => supabase
        .from('gl_accounts')
        .select('*')
        .order('code');

    // Fetch all accounts visible for the current company context
    let { data, error } = await fetchAccounts();

    if (error) {
        console.error('Error fetching chart of accounts:', error);
        throw new Error('Falha ao carregar plano de contas.');
    }

    let accounts = (data ?? []) as GLAccount[];

    // Backfill-on-read: if a company has no chart yet, seed the fixed system spine.
    if (accounts.length === 0) {
        const companyId = await getCurrentCompanyId(supabase);

        const admin = createAdminClient();
        const { error: seedError } = await admin.rpc('seed_chart_spine', {
            p_company_id: companyId
        });

        if (seedError) {
            console.error('Error seeding chart spine:', seedError);
            throw new Error('Falha ao inicializar estrutura fixa do plano de contas.');
        } else {
            const refetch = await fetchAccounts();
            if (refetch.error) {
                console.error('Error refetching chart after seed:', refetch.error);
                throw new Error('Falha ao carregar plano de contas.');
            }
            accounts = (refetch.data ?? []) as GLAccount[];
        }
    }

    return buildTree(accounts);
}

export async function getRevenueCategories() {
    const supabase = await createClient();

    // Fetch categories with linked account code
    const { data, error } = await supabase
        .from('product_categories')
        .select(`
            *,
            account:gl_accounts!revenue_account_id (
                code
            )
        `)
        .order('name');

    if (error) {
        console.error('Error fetching revenue categories:', error);
        throw new Error('Falha ao carregar categorias de receita.');
    }

    // TODO: Implement usage count via separate query or view if needed
    // For now, returning structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((item: any) => ({
        ...item,
        account_code: item.account?.code,
        usage_count: 0 // Placeholder until we have usage logic
    })) as RevenueCategory[];
}

export async function createRevenueCategory(input: z.infer<typeof createCategorySchema>) {
    const validated = createCategorySchema.parse(input);
    const supabase = await createClient();
    const companyId = await getCurrentCompanyId(supabase);

    const { data, error } = await supabase.rpc('create_revenue_category_for_finished_product', {
        p_company_id: companyId,
        p_name: validated.name,
    });

    if (error) {
        if (error.code === '23505') {
            throw new Error('Já existe uma categoria com este nome.');
        }
        throw new Error(error.message || 'Falha ao criar categoria e conta contábil.');
    }

    const parsedRows = z.array(createRevenueCategoryRpcSchema).safeParse(data);
    if (!parsedRows.success || parsedRows.data.length === 0) {
        throw new Error('Falha ao criar categoria e conta contábil.');
    }

    const row = parsedRows.data[0];
    const createdCategory: RevenueCategory = {
        id: row.category_id,
        name: row.category_name,
        normalized_name: row.category_name.trim().toLowerCase(),
        revenue_account_id: row.account_id,
        is_active: row.is_active,
        account_code: row.account_code,
    };

    return createdCategory;
}

export async function updateRevenueCategory(id: string, name: string) {
    const supabase = await createClient();
    const normalizedName = name.trim().toLowerCase();

    // 1. Update Category
    const { data: category, error: catError } = await supabase
        .from('product_categories')
        .update({ name, normalized_name: normalizedName })
        .eq('id', id)
        .select()
        .single();

    if (catError) throw new Error('Erro ao atualizar categoria.');

    // 2. Update Linked Account Name
    if (category.revenue_account_id) {
        await supabase
            .from('gl_accounts')
            .update({ name })
            .eq('id', category.revenue_account_id);
    }

    return category;
}

export async function toggleRevenueCategoryStatus(id: string, isActive: boolean) {
    const supabase = await createClient();

    // 1. Update Category
    const { data: category, error: catError } = await supabase
        .from('product_categories')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

    if (catError) throw new Error('Erro ao atualizar status da categoria.');

    // 2. Update Linked Account
    if (category.revenue_account_id) {
        await supabase
            .from('gl_accounts')
            .update({ is_active: isActive })
            .eq('id', category.revenue_account_id);
    }
}

export async function createManualAccount(parentId: string, name: string) {
    if (!name || name.trim().length < 3) throw new Error('Nome deve ter pelo menos 3 caracteres.');

    const supabase = await createClient();

    // 1. Get parent account to inherit company_id, nature, and code prefix
    const { data: parent, error: parentError } = await supabase
        .from('gl_accounts')
        .select('id, code, nature, company_id, type')
        .eq('id', parentId)
        .single();

    if (parentError || !parent) throw new Error('Conta pai não encontrada.');
    if (parent.type !== 'SINTETICA') throw new Error('Só é possível criar contas dentro de pastas (contas sintéticas).');

    // 2. Get existing children to determine next code suffix
    const { data: siblings } = await supabase
        .from('gl_accounts')
        .select('code')
        .eq('parent_id', parentId)
        .order('code', { ascending: false });

    let nextSuffix = 1;
    if (siblings && siblings.length > 0) {
        // Extract last numeric suffix from the sibling codes (e.g. "2.1.03" -> 3)
        const maxSuffix = siblings.reduce((max, s) => {
            const parts = s.code.split('.');
            const last = parseInt(parts[parts.length - 1], 10);
            return isNaN(last) ? max : Math.max(max, last);
        }, 0);
        nextSuffix = maxSuffix + 1;
    }

    const nextCode = `${parent.code}.${String(nextSuffix).padStart(2, '0')}`;

    // 3. Insert new ANALITICA account
    const { data: account, error: accError } = await supabase
        .from('gl_accounts')
        .insert({
            company_id: parent.company_id,
            code: nextCode,
            name: name.trim(),
            type: 'ANALITICA',
            nature: parent.nature,
            parent_id: parentId,
            is_system_locked: false,
            origin: 'MANUAL',
            is_active: true,
        })
        .select()
        .single();

    if (accError) {
        if (accError.code === '23505') throw new Error('Já existe uma conta com este código. Tente novamente.');
        throw new Error(`Erro ao criar conta: ${accError.message}`);
    }

    return account as GLAccount;
}

export async function updateManualAccount(id: string, name: string) {
    if (!name || name.trim().length < 3) throw new Error('Nome deve ter pelo menos 3 caracteres.');

    const supabase = await createClient();

    const { data: account, error: fetchError } = await supabase
        .from('gl_accounts')
        .select('origin, is_system_locked')
        .eq('id', id)
        .single();

    if (fetchError || !account) throw new Error('Conta não encontrada.');
    if (account.is_system_locked) throw new Error('Contas do sistema não podem ser editadas.');
    if (account.origin !== 'MANUAL') throw new Error('Somente contas manuais podem ser renomeadas.');

    const { error } = await supabase
        .from('gl_accounts')
        .update({ name: name.trim() })
        .eq('id', id);

    if (error) throw new Error(`Erro ao atualizar conta: ${error.message}`);
}

export async function deleteManualAccount(id: string): Promise<{ mode: 'hard' | 'soft' }> {
    const supabase = await createClient();

    const { data: account, error: fetchError } = await supabase
        .from('gl_accounts')
        .select('origin, is_system_locked, type')
        .eq('id', id)
        .single();

    if (fetchError || !account) throw new Error('Conta não encontrada.');
    if (account.is_system_locked) throw new Error('Contas do sistema não podem ser excluídas.');
    if (account.origin !== 'MANUAL') throw new Error('Somente contas manuais podem ser excluídas.');
    if (account.type === 'SINTETICA') throw new Error('Pastas só podem ser excluídas quando estiverem vazias e não são suportadas nesta versão.');

    // Check if there are any financial_events referencing this account
    const { count } = await supabase
        .from('financial_events')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', id);

    if (count && count > 0) {
        // Soft delete: just deactivate
        const { error } = await supabase
            .from('gl_accounts')
            .update({ is_active: false })
            .eq('id', id);
        if (error) throw new Error(`Erro ao inativar conta: ${error.message}`);
        return { mode: 'soft' };
    } else {
        // Hard delete: no references
        const { error } = await supabase
            .from('gl_accounts')
            .delete()
            .eq('id', id);
        if (error) throw new Error(`Erro ao excluir conta: ${error.message}`);
        return { mode: 'hard' };
    }
}

export async function deleteRevenueCategory(id: string) {


    const supabase = await createClient();

    // 1. Check Usage
    // TODO: Implement real usage check (products, sales lines)
    // For V1 MVP: Allow if no products linked.

    /*
    const { count } = await supabase
        .from('items') // assuming 'items' table links to Category? Or 'products'? 
        // Need to check specific schema link. Usually items -> category_id
        .select('*', { count: 'exact', head: true })
    //.eq('category_id', id); // CHECK SCHEMA FOR THIS LINK
    // Schema check: product_categories id is referenced by items? 
    // Let's assume strict check later. For now, proceeding.
    */

    // 2. Get Account ID before deleting
    const { data: category } = await supabase
        .from('product_categories')
        .select('revenue_account_id')
        .eq('id', id)
        .single();

    if (!category) throw new Error('Categoria não encontrada.');

    // 3. Delete Category
    const { error: delError } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

    if (delError) throw new Error('Erro ao excluir categoria (pode estar em uso).');

    // 4. Delete Linked Account
    if (category.revenue_account_id) {
        await supabase
            .from('gl_accounts')
            .delete()
            .eq('id', category.revenue_account_id);
    }
}

// Helpers

function buildTree(accounts: GLAccount[]): GLAccount[] {
    const map = new Map<string, GLAccount>();
    const roots: GLAccount[] = [];

    // Initialize map with children array
    accounts.forEach(acc => {
        map.set(acc.id, { ...acc, children: [] });
    });

    accounts.forEach(acc => {
        const node = map.get(acc.id)!;
        if (acc.parent_id && map.has(acc.parent_id)) {
            map.get(acc.parent_id)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}
