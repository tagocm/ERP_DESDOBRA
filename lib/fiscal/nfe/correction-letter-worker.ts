import { createAdminClient } from "@/lib/supabaseServer";
import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { submitCorrectionLetter } from "@/lib/nfe/sefaz/services/correctionLetter";
import { normalizeCorrectionText, validateCorrectionText, validateCorrectionSequence } from "./correction-letter-rules";
import { ensureEmissionProtocol } from "./ensure-emission-protocol";

type CorrectionLetterJobPayload = {
    correctionLetterId?: string;
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
        throw new Error("Empresa emissora não encontrada para envio da CC-e.");
    }

    throw new Error("CNPJ da empresa emissora inválido para envio da CC-e.");
}

export async function processCorrectionLetterJob(payload: CorrectionLetterJobPayload) {
    const correctionLetterId = payload?.correctionLetterId;
    const companyId = payload?.companyId;

    if (!correctionLetterId || !companyId) {
        throw new Error("Payload inválido para NFE_CCE: correctionLetterId e companyId são obrigatórios.");
    }

    const admin = createAdminClient();

    const { data: letter, error: letterError } = await admin
        .from("nfe_correction_letters")
        .select("id,company_id,nfe_emission_id,sales_document_id,access_key,sequence,correction_text,status")
        .eq("id", correctionLetterId)
        .eq("company_id", companyId)
        .maybeSingle();

    if (letterError || !letter) {
        throw new Error("Carta de correção não encontrada para processamento.");
    }

    const normalizedText = normalizeCorrectionText(letter.correction_text || "");
    const validation = validateCorrectionText(normalizedText);
    const sequenceValidation = validateCorrectionSequence(Number(letter.sequence || 0));
    if (!validation.valid) {
        await admin
            .from("nfe_correction_letters")
            .update({
                status: "failed",
                x_motivo: validation.message,
                c_stat: null,
            })
            .eq("id", letter.id);
        throw new Error(validation.message);
    }

    if (!sequenceValidation.valid) {
        await admin
            .from("nfe_correction_letters")
            .update({
                status: "failed",
                x_motivo: sequenceValidation.message,
                c_stat: null,
            })
            .eq("id", letter.id);
        throw new Error(sequenceValidation.message);
    }

    const { data: emission, error: emissionError } = await admin
        .from("nfe_emissions")
        .select("id,company_id,sales_document_id,access_key,status,tp_amb,uf,n_prot")
        .eq("id", letter.nfe_emission_id)
        .eq("company_id", companyId)
        .maybeSingle();

    try {
        if (emissionError || !emission) {
            throw new Error("Emissão NF-e vinculada à CC-e não foi encontrada.");
        }

        if (emission.status !== "authorized") {
            throw new Error("Somente NF-e autorizada pode receber carta de correção.");
        }

        const nProt = await ensureEmissionProtocol({
            admin,
            emissionId: emission.id,
            companyId,
            accessKey: emission.access_key,
            existingNProt: emission.n_prot,
        });

        if (!nProt) {
            throw new Error("NF-e sem protocolo de autorização (nProt). Não é possível enviar CC-e.");
        }

        const issuerCnpj =
            extractIssuerCnpjFromAccessKey(emission.access_key) ||
            await resolveIssuerCnpj(admin, companyId);

        const tpAmb = emission.tp_amb === "1" ? "1" : "2";
        const uf = emission.uf || "SP";

        await admin
            .from("nfe_correction_letters")
            .update({
                status: "processing",
                correction_text: normalizedText,
                x_motivo: null,
            })
            .eq("id", letter.id);

        const cert = await loadCompanyCertificate(companyId);
        const result = await submitCorrectionLetter({
            accessKey: emission.access_key,
            sequence: letter.sequence,
            correctionText: normalizedText,
            tpAmb,
            uf,
            issuerCnpj,
        }, cert, {
            debug: process.env.NFE_WS_DEBUG === "1",
        });

        const nextStatus = result.success ? "authorized" : "rejected";
        await admin
            .from("nfe_correction_letters")
            .update({
                status: nextStatus,
                c_stat: result.eventCStat || result.cStat,
                x_motivo: result.eventXMotivo || result.xMotivo,
                protocol: result.eventProtocol || null,
                request_xml: result.signedXml,
                response_xml: result.responseXml,
                processed_at: new Date().toISOString(),
            })
            .eq("id", letter.id);

        if (!result.success) {
            throw new Error(result.eventXMotivo || result.xMotivo || "SEFAZ rejeitou a carta de correção.");
        }
    } catch (error: any) {
        await admin
            .from("nfe_correction_letters")
            .update({
                status: "failed",
                x_motivo: error?.message || "Falha ao processar carta de correção.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", letter.id);
        throw error;
    }
}
