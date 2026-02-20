"use client";

import { Badge } from "@/components/ui/Badge";
import type {
    FactorItemAction,
    FactorOperationStatus,
    FactorResponseStatus,
} from "@/lib/data/finance/factor/types";

const operationStatusMeta: Record<FactorOperationStatus, { label: string; className: string }> = {
    draft: {
        label: "Rascunho",
        className: "bg-gray-100 text-gray-700 border-gray-200",
    },
    sent_to_factor: {
        label: "Enviada à Factor",
        className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    in_adjustment: {
        label: "Em Ajuste",
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    completed: {
        label: "Concluída",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    cancelled: {
        label: "Cancelada",
        className: "bg-red-100 text-red-700 border-red-200",
    },
};

const responseStatusMeta: Record<FactorResponseStatus, { label: string; className: string }> = {
    pending: {
        label: "Pendente",
        className: "bg-gray-100 text-gray-700 border-gray-200",
    },
    accepted: {
        label: "Aceito",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    rejected: {
        label: "Recusado",
        className: "bg-red-100 text-red-700 border-red-200",
    },
    adjusted: {
        label: "Ajustado",
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
};

const actionMeta: Record<FactorItemAction, { label: string; className: string }> = {
    discount: {
        label: "Desconto",
        className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    buyback: {
        label: "Recompra",
        className: "bg-purple-100 text-purple-700 border-purple-200",
    },
    due_date_change: {
        label: "Alterar Vencimento",
        className: "bg-cyan-100 text-cyan-700 border-cyan-200",
    },
};

export function FactorOperationStatusBadge({ status }: { status: FactorOperationStatus }) {
    const meta = operationStatusMeta[status];
    return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
}

export function FactorResponseStatusBadge({ status }: { status: FactorResponseStatus }) {
    const meta = responseStatusMeta[status];
    return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
}

export function FactorActionBadge({ action }: { action: FactorItemAction }) {
    const meta = actionMeta[action];
    return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
}

export function getOperationStatusLabel(status: FactorOperationStatus): string {
    return operationStatusMeta[status].label;
}
