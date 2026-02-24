import { z } from "zod";
import { ReversalReasonCodeSchema } from "./schemas";

export type ReversalReasonCode = z.infer<typeof ReversalReasonCodeSchema>;

export const REVERSAL_NATOP = "RETORNO / DEVOLUCAO DE VENDA - NAO ENTREGUE";

export const REVERSAL_REASON_LABELS_PT: Record<ReversalReasonCode, string> = {
    MERCADORIA_NAO_ENTREGUE: "Mercadoria não entregue (retornou)",
    RECUSA_DESTINATARIO: "Recusa do destinatário",
    ENDERECO_INCORRETO: "Endereço incorreto / não localizado",
    ERRO_OPERACIONAL: "Erro operacional / remessa não realizada",
    OUTROS: "Outros",
};

export function buildReversalInfCpl(args: {
    outboundAccessKey: string;
    reasonCode: ReversalReasonCode;
    reasonOther?: string | null;
    isPartial: boolean;
}) {
    const reasonLabel = REVERSAL_REASON_LABELS_PT[args.reasonCode] || "Outros";
    const reasonText = args.reasonCode === "OUTROS"
        ? (args.reasonOther?.trim() || reasonLabel)
        : reasonLabel;

    const parts = [
        `NF-e de entrada de estorno por não entrega.`,
        `Referência à NF-e chave: ${args.outboundAccessKey}.`,
        `Motivo: ${reasonText}.`,
        args.isPartial ? `Estorno parcial conforme itens/quantidades.` : null,
    ].filter((v): v is string => Boolean(v));

    // SEFAZ limits vary; keep it short and explicit.
    return parts.join(" ");
}

