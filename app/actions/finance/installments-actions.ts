'use server';

import {
    recalculateInstallments,
    PaymentTermConfig,
    RecalculatedInstallment
} from '@/lib/utils/finance-calculations';

export type InstallmentsActionResult = {
    ok: boolean;
    data?: RecalculatedInstallment[];
    error?: { message: string };
};

export async function recalculateInstallmentsAction(
    totalAmount: number,
    baseDate: Date | string, // Accept string to be serialization safe
    paymentTerm: PaymentTermConfig,
    paymentMethod: string | null,
    paymentConditionName: string
): Promise<InstallmentsActionResult> {
    try {
        const dateObj = typeof baseDate === 'string' ? new Date(baseDate) : baseDate;

        const data = recalculateInstallments(
            totalAmount,
            dateObj,
            paymentTerm,
            paymentMethod,
            paymentConditionName
        );

        return { ok: true, data };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: { message } };
    }
}
