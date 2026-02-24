import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialEvent } from '@/lib/finance/events-db';

const createAdminClientMock = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabaseServer', () => ({
    createAdminClient: () => createAdminClientMock()
}));

describe('generateARTitle idempotência', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reutiliza título existente quando source_event_id já está vinculado', async () => {
        const { generateARTitle } = await import('@/lib/finance/title-generator');

        const maybeSingleMock = vi.fn(async () => ({ data: { id: 'existing-title' }, error: null }));
        const orderMock = vi.fn(async () => ({
            data: [{ id: 'installment-1', installment_number: 1, amount_original: 120 }],
            error: null
        }));

        const eqChainForTitles = {
            eq: vi.fn(() => ({ maybeSingle: maybeSingleMock }))
        };

        const selectForTitles = {
            eq: vi.fn(() => eqChainForTitles)
        };

        const eqChainForInstallments = {
            order: orderMock
        };

        const selectForInstallments = {
            eq: vi.fn(() => eqChainForInstallments)
        };

        createAdminClientMock.mockReturnValue({
            from: vi.fn((table: string) => {
                if (table === 'ar_titles') {
                    return { select: vi.fn(() => selectForTitles) };
                }
                if (table === 'ar_installments') {
                    return { select: vi.fn(() => selectForInstallments) };
                }
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) }))
                };
            })
        });

        const event: FinancialEvent = {
            id: 'f744299a-c8ad-4547-9960-2f7fcb835b81',
            company_id: 'f2942f1a-4260-4c67-b8d8-d4783e4ecdc9',
            origin_type: 'MANUAL',
            origin_id: '8a73f9d8-67c7-4bb0-8c58-8bb6caec5ea4',
            origin_reference: 'MANUAL-1',
            partner_id: '781f168e-9f1b-4ee8-a099-38f7541fa255',
            partner_name: 'Parceiro',
            direction: 'AR',
            issue_date: '2026-02-24',
            total_amount: 120,
            status: 'pending',
            approved_by: null,
            approved_at: null,
            approval_snapshot: null,
            rejected_by: null,
            rejected_at: null,
            rejection_reason: null,
            attention_marked_by: null,
            attention_marked_at: null,
            attention_reason: null,
            notes: null,
            created_at: '2026-02-24T00:00:00.000Z',
            updated_at: '2026-02-24T00:00:00.000Z',
            installments: [
                {
                    id: 'installment-1',
                    event_id: 'f744299a-c8ad-4547-9960-2f7fcb835b81',
                    installment_number: 1,
                    due_date: '2026-03-24',
                    amount: 120,
                    payment_condition: '30 dias',
                    payment_method: 'boleto',
                    suggested_account_id: null,
                    category_id: null,
                    cost_center_id: null,
                    financial_account_id: null,
                    notes: null,
                    created_at: '2026-02-24T00:00:00.000Z',
                    updated_at: '2026-02-24T00:00:00.000Z'
                }
            ]
        };

        const titleId = await generateARTitle(event);
        expect(titleId).toBe('existing-title');
        expect(maybeSingleMock).toHaveBeenCalledTimes(1);
        expect(orderMock).toHaveBeenCalledTimes(1);
    });
});
