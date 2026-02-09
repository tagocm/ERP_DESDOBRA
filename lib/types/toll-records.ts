export type PaymentMethod = 'cash' | 'card' | 'tag' | 'pix';

export const paymentMethodLabels: Record<PaymentMethod, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    tag: 'Tag/Sem Parar',
    pix: 'PIX'
};

export interface TollRecordRow {
    id: string;
    company_id: string;
    vehicle_id: string;
    toll_date: string;
    toll_time: string;
    location: string;
    amount: number;
    payment_method: string;
    notes: string | null;
    created_at: string;
    created_by: string | null;
    updated_at: string;
    updated_by: string | null;
}

export type TollRecordCreateInput = Omit<TollRecordRow, 'id' | 'company_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>;
export type TollRecordUpdateInput = Partial<TollRecordCreateInput> & { id: string };

export interface TollRecordListFilters {
    startDate?: string;
    endDate?: string;
    paymentMethod?: PaymentMethod;
    search?: string;
}

export interface TollStats {
    totalRecords: number;
    totalAmount: number;
    avgAmount: number;
}

export type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { message: string; code?: string } };
