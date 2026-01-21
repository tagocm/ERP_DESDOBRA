/**
 * Central Status Badge Color Configuration
 * 
 * Defines consistent colors for status badges across all sectors:
 * - Commercial (Comercial)
 * - Logistics (Logístico)
 * - Financial (Financeiro)
 * 
 * Color scheme uses soft backgrounds with darker text for accessibility.
 */

export type StatusBadgeStyle = {
    bg: string;
    text: string;
    label: string;
};

// ============================================
// COMMERCIAL STATUS (Status Comercial)
// ============================================
export const COMMERCIAL_STATUS_COLORS: Record<string, StatusBadgeStyle> = {
    draft: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: "Rascunho"
    },
    confirmed: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: "Confirmado"
    },
    // Legacy statuses (mantidos para compatibilidade)
    sent: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: "Enviado"
    },
    approved: {
        bg: "bg-indigo-100",
        text: "text-indigo-700",
        label: "Aprovado"
    },
    cancelled: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: "Cancelado"
    },
    lost: {
        bg: "bg-gray-100",
        text: "text-gray-500",
        label: "Perdido"
    }
};

// ============================================
// LOGISTICS STATUS (Status Logístico)
// ============================================
export const LOGISTICS_STATUS_COLORS: Record<string, StatusBadgeStyle> = {
    pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        label: "Pendente"
    },
    pendente: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        label: "Pendente"
    },
    roteirizado: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: "Roteirizado"
    },
    agendado: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: "Agendado"
    },
    em_rota: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        label: "Em Rota"
    },
    entregue: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: "Entregue"
    },
    nao_entregue: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: "Não Entregue"
    },
    parcial: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        label: "Parcial"
    },
    // Legacy statuses (mantidos para compatibilidade)
    separation: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        label: "Em Separação"
    },
    expedition: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: "Expedição"
    },
    delivered: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: "Entregue"
    }
};

// ============================================
// FINANCIAL STATUS (Status Financeiro)
// ============================================
export const FINANCIAL_STATUS_COLORS: Record<string, StatusBadgeStyle> = {
    pendente: {
        bg: "bg-gray-100",
        text: "text-gray-600", // #6B7280 matches gray-500/600 range
        label: "Pendente"
    },
    pre_lancado: {
        bg: "bg-blue-100",
        text: "text-blue-700", // #2563EB matches blue-600/700
        label: "Pré-lançado"
    },
    aprovado: {
        bg: "bg-green-100",
        text: "text-green-700", // #16A34A matches green-600/700
        label: "Aprovado"
    },
    em_revisao: {
        bg: "bg-amber-100",
        text: "text-amber-700", // #F59E0B matches amber-500/600
        label: "Em Revisão"
    },
    cancelado: {
        bg: "bg-red-100",
        text: "text-red-700", // #DC2626 matches red-600/700
        label: "Cancelado"
    },
    // Legacy mapping (to prevent UI crashes if frontend still sees old data temporarily)
    pending: { bg: "bg-gray-100", text: "text-gray-600", label: "Pendente" },

    paid: { bg: "bg-green-100", text: "text-green-700", label: "Aprovado" },
    partial: { bg: "bg-green-100", text: "text-green-700", label: "Aprovado" },
    overdue: { bg: "bg-green-100", text: "text-green-700", label: "Aprovado" },
    refunded: { bg: "bg-red-100", text: "text-red-700", label: "Cancelado" }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get badge style for a commercial status
 */
export function getCommercialBadgeStyle(status: string): StatusBadgeStyle {
    return COMMERCIAL_STATUS_COLORS[status] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        label: status
    };
}

/**
 * Get badge style for a logistics status
 */
export function getLogisticsBadgeStyle(status: string): StatusBadgeStyle {
    return LOGISTICS_STATUS_COLORS[status] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        label: status
    };
}

/**
 * Get badge style for a financial status
 */
export function getFinancialBadgeStyle(status: string): StatusBadgeStyle {
    return FINANCIAL_STATUS_COLORS[status] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        label: status
    };
}

/**
 * Get combined CSS class string for a status badge
 */
export function getStatusBadgeClass(sector: 'commercial' | 'logistics' | 'financial', status: string): string {
    let style: StatusBadgeStyle;

    switch (sector) {
        case 'commercial':
            style = getCommercialBadgeStyle(status);
            break;
        case 'logistics':
            style = getLogisticsBadgeStyle(status);
            break;
        case 'financial':
            style = getFinancialBadgeStyle(status);
            break;
        default:
            style = { bg: "bg-gray-100", text: "text-gray-600", label: status };
    }

    return `${style.bg} ${style.text}`;
}
