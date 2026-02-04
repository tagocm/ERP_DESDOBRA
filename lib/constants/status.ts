export const LOGISTICS_STATUS = {
    pending: "pending",
    routed: "routed",
    scheduled: "scheduled",
    in_route: "in_route",
    delivered: "delivered",
    not_delivered: "not_delivered",
    returned: "returned",
    partial: "partial",
    cancelled: "cancelled",
    sandbox: "sandbox",
    // Legacy EN values kept for compatibility
    separation: "separation",
    expedition: "expedition",
} as const;

export type LogisticsStatus = typeof LOGISTICS_STATUS[keyof typeof LOGISTICS_STATUS];

const LOGISTICS_STATUS_MAP: Record<string, LogisticsStatus> = {
    // PT -> EN
    pendente: LOGISTICS_STATUS.pending,
    roteirizado: LOGISTICS_STATUS.routed,
    agendado: LOGISTICS_STATUS.scheduled,
    em_rota: LOGISTICS_STATUS.in_route,
    entregue: LOGISTICS_STATUS.delivered,
    nao_entregue: LOGISTICS_STATUS.not_delivered,
    devolvido: LOGISTICS_STATUS.returned,
    parcial: LOGISTICS_STATUS.partial,
    cancelado: LOGISTICS_STATUS.cancelled,
    sandbox: LOGISTICS_STATUS.sandbox,
    // EN -> EN
    pending: LOGISTICS_STATUS.pending,
    routed: LOGISTICS_STATUS.routed,
    scheduled: LOGISTICS_STATUS.scheduled,
    in_route: LOGISTICS_STATUS.in_route,
    delivered: LOGISTICS_STATUS.delivered,
    not_delivered: LOGISTICS_STATUS.not_delivered,
    returned: LOGISTICS_STATUS.returned,
    partial: LOGISTICS_STATUS.partial,
    cancelled: LOGISTICS_STATUS.cancelled,
    separation: LOGISTICS_STATUS.separation,
    expedition: LOGISTICS_STATUS.expedition,
};

export const LOGISTICS_STATUS_LABELS_PT: Record<LogisticsStatus, string> = {
    pending: "Pendente",
    routed: "Roteirizado",
    scheduled: "Agendado",
    in_route: "Em rota",
    delivered: "Entregue",
    not_delivered: "Não entregue",
    returned: "Devolvido",
    partial: "Parcial",
    cancelled: "Cancelado",
    sandbox: "Sandbox",
    separation: "Em separação",
    expedition: "Expedição",
};

export function normalizeLogisticsStatus(value?: string | null): LogisticsStatus | undefined {
    if (!value) return undefined;
    return LOGISTICS_STATUS_MAP[value] ?? LOGISTICS_STATUS_MAP[value.toLowerCase()];
}

export function translateLogisticsStatusPt(value?: string | null): string {
    const normalized = normalizeLogisticsStatus(value);
    if (!normalized) return value || "";
    return LOGISTICS_STATUS_LABELS_PT[normalized] || value || "";
}

export const LOADING_STATUS = {
    pending: "pending",
    loaded: "loaded",
    partial: "partial",
    not_loaded: "not_loaded",
} as const;

export type LoadingStatus = typeof LOADING_STATUS[keyof typeof LOADING_STATUS];

const LOADING_STATUS_MAP: Record<string, LoadingStatus> = {
    // PT -> EN
    pendente: LOADING_STATUS.pending,
    carregado: LOADING_STATUS.loaded,
    parcial: LOADING_STATUS.partial,
    nao_carregado: LOADING_STATUS.not_loaded,
    // EN -> EN
    pending: LOADING_STATUS.pending,
    loaded: LOADING_STATUS.loaded,
    partial: LOADING_STATUS.partial,
    not_loaded: LOADING_STATUS.not_loaded,
};

export const LOADING_STATUS_LABELS_PT: Record<LoadingStatus, string> = {
    pending: "Pendente",
    loaded: "Carregado",
    partial: "Parcial",
    not_loaded: "Não carregado",
};

export function normalizeLoadingStatus(value?: string | null): LoadingStatus | undefined {
    if (!value) return undefined;
    return LOADING_STATUS_MAP[value] ?? LOADING_STATUS_MAP[value.toLowerCase()];
}

export function translateLoadingStatusPt(value?: string | null): string {
    const normalized = normalizeLoadingStatus(value);
    if (!normalized) return value || "";
    return LOADING_STATUS_LABELS_PT[normalized] || value || "";
}

export const FINANCIAL_STATUS = {
    pending: "pending",
    pre_posted: "pre_posted",
    approved: "approved",
    in_review: "in_review",
    cancelled: "cancelled",
    paid: "paid",
    overdue: "overdue",
    partial: "partial",
} as const;

export type FinancialStatus = typeof FINANCIAL_STATUS[keyof typeof FINANCIAL_STATUS];

const FINANCIAL_STATUS_MAP: Record<string, FinancialStatus> = {
    // PT -> EN
    pendente: FINANCIAL_STATUS.pending,
    pre_lancado: FINANCIAL_STATUS.pre_posted,
    aprovado: FINANCIAL_STATUS.approved,
    em_revisao: FINANCIAL_STATUS.in_review,
    cancelado: FINANCIAL_STATUS.cancelled,
    pago: FINANCIAL_STATUS.paid,
    atrasado: FINANCIAL_STATUS.overdue,
    parcial: FINANCIAL_STATUS.partial,
    // EN -> EN
    pending: FINANCIAL_STATUS.pending,
    pre_posted: FINANCIAL_STATUS.pre_posted,
    approved: FINANCIAL_STATUS.approved,
    in_review: FINANCIAL_STATUS.in_review,
    cancelled: FINANCIAL_STATUS.cancelled,
    paid: FINANCIAL_STATUS.paid,
    overdue: FINANCIAL_STATUS.overdue,
    partial: FINANCIAL_STATUS.partial,
};

export const FINANCIAL_STATUS_LABELS_PT: Record<FinancialStatus, string> = {
    pending: "Pendente",
    pre_posted: "Pré-lançado",
    approved: "Aprovado",
    in_review: "Em revisão",
    cancelled: "Cancelado",
    paid: "Pago",
    overdue: "Atrasado",
    partial: "Parcial",
};

export function normalizeFinancialStatus(value?: string | null): FinancialStatus | undefined {
    if (!value) return undefined;
    return FINANCIAL_STATUS_MAP[value] ?? FINANCIAL_STATUS_MAP[value.toLowerCase()];
}

export function translateFinancialStatusPt(value?: string | null): string {
    const normalized = normalizeFinancialStatus(value);
    if (!normalized) return value || "";
    return FINANCIAL_STATUS_LABELS_PT[normalized] || value || "";
}

export const FINANCIAL_EVENT_STATUS = {
    pending: "pending",
    attention: "attention",
    approving: "approving",
    approved: "approved",
    rejected: "rejected",
} as const;

export type FinancialEventStatus = typeof FINANCIAL_EVENT_STATUS[keyof typeof FINANCIAL_EVENT_STATUS];

const FINANCIAL_EVENT_STATUS_MAP: Record<string, FinancialEventStatus> = {
    // PT -> EN
    pendente: FINANCIAL_EVENT_STATUS.pending,
    em_atencao: FINANCIAL_EVENT_STATUS.attention,
    aprovando: FINANCIAL_EVENT_STATUS.approving,
    aprovado: FINANCIAL_EVENT_STATUS.approved,
    reprovado: FINANCIAL_EVENT_STATUS.rejected,
    // EN -> EN
    pending: FINANCIAL_EVENT_STATUS.pending,
    attention: FINANCIAL_EVENT_STATUS.attention,
    approving: FINANCIAL_EVENT_STATUS.approving,
    approved: FINANCIAL_EVENT_STATUS.approved,
    rejected: FINANCIAL_EVENT_STATUS.rejected,
};

export const FINANCIAL_EVENT_STATUS_LABELS_PT: Record<FinancialEventStatus, string> = {
    pending: "Pendente",
    attention: "Em atenção",
    approving: "Aprovando",
    approved: "Aprovado",
    rejected: "Reprovado",
};

export function normalizeFinancialEventStatus(value?: string | null): FinancialEventStatus | undefined {
    if (!value) return undefined;
    return FINANCIAL_EVENT_STATUS_MAP[value] ?? FINANCIAL_EVENT_STATUS_MAP[value.toLowerCase()];
}

export function translateFinancialEventStatusPt(value?: string | null): string {
    const normalized = normalizeFinancialEventStatus(value);
    if (!normalized) return value || "";
    return FINANCIAL_EVENT_STATUS_LABELS_PT[normalized] || value || "";
}

export const ROUTE_STATUS = {
    pending: "pending",
    scheduled: "scheduled",
    in_route: "in_route",
    completed: "completed",
    cancelled: "cancelled",
    in_progress: "in_progress",
} as const;

export type RouteStatus = typeof ROUTE_STATUS[keyof typeof ROUTE_STATUS];

const ROUTE_STATUS_MAP: Record<string, RouteStatus> = {
    // PT -> EN
    pendente: ROUTE_STATUS.pending,
    agendado: ROUTE_STATUS.scheduled,
    em_rota: ROUTE_STATUS.in_route,
    concluida: ROUTE_STATUS.completed,
    cancelada: ROUTE_STATUS.cancelled,
    // EN -> EN
    pending: ROUTE_STATUS.pending,
    scheduled: ROUTE_STATUS.scheduled,
    in_route: ROUTE_STATUS.in_route,
    completed: ROUTE_STATUS.completed,
    cancelled: ROUTE_STATUS.cancelled,
    in_progress: ROUTE_STATUS.in_progress,
};

export const ROUTE_STATUS_LABELS_PT: Record<RouteStatus, string> = {
    pending: "Pendente",
    scheduled: "Agendado",
    in_route: "Em rota",
    completed: "Concluída",
    cancelled: "Cancelada",
    in_progress: "Em progresso",
};

export function normalizeRouteStatus(value?: string | null): RouteStatus | undefined {
    if (!value) return undefined;
    return ROUTE_STATUS_MAP[value] ?? ROUTE_STATUS_MAP[value.toLowerCase()];
}

export function translateRouteStatusPt(value?: string | null): string {
    const normalized = normalizeRouteStatus(value);
    if (!normalized) return value || "";
    return ROUTE_STATUS_LABELS_PT[normalized] || value || "";
}
