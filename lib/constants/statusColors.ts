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

import {
    normalizeFinancialStatus,
    normalizeLogisticsStatus,
    FINANCIAL_STATUS_LABELS_PT,
    LOGISTICS_STATUS_LABELS_PT,
} from "@/lib/constants/status";

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
        label: LOGISTICS_STATUS_LABELS_PT.pending
    },
    routed: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: LOGISTICS_STATUS_LABELS_PT.routed
    },
    scheduled: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: LOGISTICS_STATUS_LABELS_PT.scheduled
    },
    in_route: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        label: LOGISTICS_STATUS_LABELS_PT.in_route
    },
    delivered: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: LOGISTICS_STATUS_LABELS_PT.delivered
    },
    not_delivered: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: LOGISTICS_STATUS_LABELS_PT.not_delivered
    },
    partial: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        label: LOGISTICS_STATUS_LABELS_PT.partial
    },
    returned: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        label: LOGISTICS_STATUS_LABELS_PT.returned
    },
    cancelled: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: LOGISTICS_STATUS_LABELS_PT.cancelled
    },
    sandbox: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: LOGISTICS_STATUS_LABELS_PT.sandbox
    },
    // Legacy statuses (mantidos para compatibilidade)
    separation: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        label: LOGISTICS_STATUS_LABELS_PT.separation
    },
    expedition: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: LOGISTICS_STATUS_LABELS_PT.expedition
    }
};

// ============================================
// FINANCIAL STATUS (Status Financeiro)
// ============================================
export const FINANCIAL_STATUS_COLORS: Record<string, StatusBadgeStyle> = {
    pending: {
        bg: "bg-gray-100",
        text: "text-gray-600", // #6B7280 matches gray-500/600 range
        label: FINANCIAL_STATUS_LABELS_PT.pending
    },
    pre_posted: {
        bg: "bg-blue-100",
        text: "text-blue-700", // #2563EB matches blue-600/700
        label: FINANCIAL_STATUS_LABELS_PT.pre_posted
    },
    approved: {
        bg: "bg-green-100",
        text: "text-green-700", // #16A34A matches green-600/700
        label: FINANCIAL_STATUS_LABELS_PT.approved
    },
    in_review: {
        bg: "bg-amber-100",
        text: "text-amber-700", // #F59E0B matches amber-500/600
        label: FINANCIAL_STATUS_LABELS_PT.in_review
    },
    cancelled: {
        bg: "bg-red-100",
        text: "text-red-700", // #DC2626 matches red-600/700
        label: FINANCIAL_STATUS_LABELS_PT.cancelled
    },
    paid: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: FINANCIAL_STATUS_LABELS_PT.paid
    },
    partial: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        label: FINANCIAL_STATUS_LABELS_PT.partial
    },
    overdue: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: FINANCIAL_STATUS_LABELS_PT.overdue
    }
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
    const normalized = normalizeLogisticsStatus(status);
    return LOGISTICS_STATUS_COLORS[normalized || status] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        label: status
    };
}

/**
 * Get badge style for a financial status
 */
export function getFinancialBadgeStyle(status: string): StatusBadgeStyle {
    const normalized = normalizeFinancialStatus(status);
    return FINANCIAL_STATUS_COLORS[normalized || status] || {
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
