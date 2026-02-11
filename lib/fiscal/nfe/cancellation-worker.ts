import { createAdminClient } from "@/lib/supabaseServer";
import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { submitNfeCancellation } from "@/lib/nfe/sefaz/services/cancelNfe";
import { normalizeCancellationReason, validateCancellationReason } from "./cancellation-rules";
import { syncSalesDocumentFiscalStatus } from "./sync-sales-document-fiscal-status";

type CancellationJobPayload = {
    cancellationId?: string;
    companyId?: string;
};

function onlyDigits(value: string | null | undefined): string {
    return String(value || "").replace(/\D/g, "");
}

export async function processNfeCancellationJob(payload: CancellationJobPayload) {
    const cancellationId = payload?.cancellationId;
    const companyId = payload?.companyId;

    if (!cancellationId || !companyId) {
        throw new Error("Payload inválido para NFE_CANCEL: cancellationId e companyId são obrigatórios.");
    }

    const admin = createAdminClient();

    const { data: cancellation, error: cancellationError } = await admin
        .from("nfe_cancellations")
        .select("id,company_id,nfe_emission_id,sales_document_id,access_key,sequence,reason,status")
        .eq("id", cancellationId)
        .eq("company_id", companyId)
        .maybeSingle();

    if (cancellationError || !cancellation) {
        throw new Error("Solicitação de cancelamento não encontrada.");
    }

    const normalizedReason = normalizeCancellationReason(cancellation.reason || "");
    const validation = validateCancellationReason(normalizedReason);
    if (!validation.valid) {
        await admin
            .from("nfe_cancellations")
            .update({
                status: "failed",
                x_motivo: validation.message,
                c_stat: null,
            })
            .eq("id", cancellation.id);
        throw new Error(validation.message);
    }

    const { data: emission, error: emissionError } = await admin
        .from("nfe_emissions")
        .select("id,company_id,sales_document_id,access_key,status,tp_amb,uf,n_prot")
        .eq("id", cancellation.nfe_emission_id)
        .eq("company_id", companyId)
        .maybeSingle();

    if (emissionError || !emission) {
        throw new Error("Emissão NF-e vinculada ao cancelamento não encontrada.");
    }

    if (emission.status === "cancelled") {
        await admin
            .from("nfe_cancellations")
            .update({
                status: "authorized",
                x_motivo: "NF-e já está cancelada na base.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", cancellation.id);
        return;
    }

    if (emission.status !== "authorized") {
        throw new Error("Somente NF-e autorizada pode ser cancelada.");
    }

    if (!emission.n_prot) {
        throw new Error("NF-e sem protocolo de autorização (nProt). Não é possível cancelar.");
    }

    const { data: company, error: companyError } = await admin
        .from("companies")
        .select("id,document_number")
        .eq("id", companyId)
        .maybeSingle();

    if (companyError || !company) {
        throw new Error("Empresa emissora não encontrada para cancelamento.");
    }

    const issuerCnpj = onlyDigits(company.document_number);
    if (issuerCnpj.length !== 14) {
        throw new Error("CNPJ da empresa emissora inválido para cancelamento.");
    }

    const tpAmb = emission.tp_amb === "1" ? "1" : "2";
    const uf = emission.uf || "SP";

    await admin
        .from("nfe_cancellations")
        .update({
            status: "processing",
            reason: normalizedReason,
            x_motivo: null,
        })
        .eq("id", cancellation.id);

    try {
        const cert = await loadCompanyCertificate(companyId);
        const result = await submitNfeCancellation({
            accessKey: emission.access_key,
            protocolNumber: emission.n_prot,
            sequence: cancellation.sequence,
            reason: normalizedReason,
            tpAmb,
            uf,
            issuerCnpj,
        }, cert, {
            debug: process.env.NFE_WS_DEBUG === "1",
        });

        const eventStatus = result.success ? "authorized" : "rejected";
        await admin
            .from("nfe_cancellations")
            .update({
                status: eventStatus,
                c_stat: result.eventCStat || result.cStat,
                x_motivo: result.eventXMotivo || result.xMotivo,
                protocol: result.eventProtocol || null,
                request_xml: result.signedXml,
                response_xml: result.responseXml,
                processed_at: new Date().toISOString(),
            })
            .eq("id", cancellation.id);

        if (!result.success) {
            throw new Error(result.eventXMotivo || result.xMotivo || "SEFAZ rejeitou o cancelamento.");
        }

        await admin
            .from("nfe_emissions")
            .update({
                status: "cancelled",
                c_stat: result.eventCStat || result.cStat,
                x_motivo: result.eventXMotivo || result.xMotivo,
                updated_at: new Date().toISOString(),
            })
            .eq("id", emission.id);

        await admin
            .from("sales_document_nfes")
            .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId)
            .eq("nfe_key", emission.access_key);

        await syncSalesDocumentFiscalStatus(
            admin,
            emission.sales_document_id || undefined,
            "cancelled"
        );
    } catch (error: any) {
        await admin
            .from("nfe_cancellations")
            .update({
                status: "failed",
                x_motivo: error?.message || "Falha ao processar cancelamento da NF-e.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", cancellation.id);
        throw error;
    }
}
