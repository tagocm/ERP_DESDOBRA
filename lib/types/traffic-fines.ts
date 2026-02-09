export interface TrafficFineRow {
    id: string;
    company_id: string;
    vehicle_id: string;
    fine_date: string;
    city: string;
    reason: string;
    amount: number;
    driver_name: string;
    notes: string | null;
    deducted_from_driver: boolean;
    created_at: string;
    created_by: string | null;
    updated_at: string;
    updated_by: string | null;
}

export type TrafficFineCreateInput = Omit<TrafficFineRow, 'id' | 'company_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>;
export type TrafficFineUpdateInput = Partial<TrafficFineCreateInput> & { id: string };

export interface TrafficFineListFilters {
    startDate?: string;
    endDate?: string;
    deductedStatus?: 'all' | 'deducted' | 'not_deducted';
    search?: string;
}

export interface TrafficFineStats {
    totalRecords: number;
    totalAmount: number;
    avgAmount: number;
    totalDeducted: number;
}

export type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { message: string; code?: string } };
