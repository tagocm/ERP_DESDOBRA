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

function extractIssuerCnpjFromAccessKey(accessKey: string | null | undefined): string | null {
    const digits = onlyDigits(accessKey);
    if (digits.length !== 44) return null;
    return digits.slice(6, 20);
}

function extractUfFromAccessKey(accessKey: string | null | undefined): string | null {
    const digits = onlyDigits(accessKey);
    if (digits.length !== 44) return null;
    const cUF = digits.slice(0, 2);
    const ufMap: Record<string, string> = {
        "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
        "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
        "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
        "41": "PR", "42": "SC", "43": "RS",
        "50": "MS", "51": "MT", "52": "GO", "53": "DF",
    };
    return ufMap[cUF] || null;
}

async function resolveIssuerCnpj(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<string> {
    const { data: orgById, error: orgByIdError } = await admin
        .from("organizations")
        .select("id,document_number")
        .eq("id", companyId)
        .maybeSingle();

    if (orgByIdError) {
        throw new Error(`Falha ao consultar organização emissora (por id): ${orgByIdError.message}`);
    }

    const { data: orgByCompany, error: orgByCompanyError } = await admin
        .from("organizations")
        .select("id,document_number,deleted_at,created_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

    if (orgByCompanyError) {
        throw new Error(`Falha ao consultar organização emissora (por company_id): ${orgByCompanyError.message}`);
    }

    const candidates = [
        orgById,
        ...(orgByCompany || []),
    ].filter(Boolean);

    for (const candidate of candidates) {
        const cnpj = onlyDigits((candidate as { document_number?: string | null }).document_number);
        if (cnpj.length === 14) return cnpj;
    }

    if (candidates.length === 0) {
        throw new Error("Empresa emissora não encontrada para cancelamento.");
    }

    throw new Error("CNPJ da empresa emissora inválido para cancelamento.");
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

    const issuerCnpj =
        extractIssuerCnpjFromAccessKey(emission.access_key) ||
        await resolveIssuerCnpj(admin, companyId);

    const tpAmb = emission.tp_amb === "1" ? "1" : "2";
    const ufFromKey = extractUfFromAccessKey(emission.access_key);
    const uf = ufFromKey || emission.uf || "SP";

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

        const eventCode = result.eventCStat || result.cStat || "";
        const eventReason = result.eventXMotivo || result.xMotivo || "";
        const duplicateEvent =
            eventCode === "573" ||
            /duplicidade de evento/i.test(eventReason);
        const acceptedOrAlreadyProcessed = result.success || duplicateEvent;

        const eventStatus = acceptedOrAlreadyProcessed ? "authorized" : "rejected";
        await admin
            .from("nfe_cancellations")
            .update({
                status: eventStatus,
                c_stat: eventCode || null,
                x_motivo: eventReason || null,
                protocol: result.eventProtocol || null,
                request_xml: result.signedXml,
                response_xml: result.responseXml,
                processed_at: new Date().toISOString(),
            })
            .eq("id", cancellation.id);

        if (!acceptedOrAlreadyProcessed) {
            throw new Error(eventReason || "SEFAZ rejeitou o cancelamento.");
        }

        await admin
            .from("nfe_emissions")
            .update({
                status: "cancelled",
                c_stat: eventCode || null,
                x_motivo: eventReason || null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", emission.id);

        await admin
            .from("sales_document_nfes")
            .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
            })
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
