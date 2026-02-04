export type DeliveryReasonGroup = 'EXPEDICAO_CARREGADO_PARCIAL' | 'EXPEDICAO_NAO_CARREGADO' | 'RETORNO_ENTREGA_PARCIAL' | 'RETORNO_NAO_ENTREGUE';

export interface DeliveryReason {
    id: string;
    company_id: string;
    name: string;
    reason_group: DeliveryReasonGroup;
    is_active: boolean;
    require_note: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export const DELIVERY_REASON_GROUPS: { code: DeliveryReasonGroup; label: string }[] = [
    { code: 'EXPEDICAO_CARREGADO_PARCIAL', label: 'Carregamento Parcial' },
    { code: 'EXPEDICAO_NAO_CARREGADO', label: 'Não Carregamento' }, // Future use
    { code: 'RETORNO_ENTREGA_PARCIAL', label: 'Entrega Parcial / Devolução Parcial' }, // Mapped from old structure
    { code: 'RETORNO_NAO_ENTREGUE', label: 'Não Entregue / Devolução Total' }, // Mapped from old structure
];

export type OccurrenceReason = DeliveryReason;
