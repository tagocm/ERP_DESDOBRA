import { createAdminClient } from "@/lib/supabaseServer";
import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { submitCorrectionLetter } from "@/lib/nfe/sefaz/services/correctionLetter";
import { normalizeCorrectionText, validateCorrectionText } from "./correction-letter-rules";

type CorrectionLetterJobPayload = {
    correctionLetterId?: string;
    companyId?: string;
};

function onlyDigits(value: string | null | undefined): string {
    return String(value || "").replace(/\D/g, "");
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

    const { data: emission, error: emissionError } = await admin
        .from("nfe_emissions")
        .select("id,company_id,sales_document_id,access_key,status,tp_amb,uf,n_prot")
        .eq("id", letter.nfe_emission_id)
        .eq("company_id", companyId)
        .maybeSingle();

    if (emissionError || !emission) {
        throw new Error("Emissão NF-e vinculada à CC-e não foi encontrada.");
    }

    if (emission.status !== "authorized") {
        throw new Error("Somente NF-e autorizada pode receber carta de correção.");
    }

    if (!emission.n_prot) {
        throw new Error("NF-e sem protocolo de autorização (nProt). Não é possível enviar CC-e.");
    }

    const { data: company, error: companyError } = await admin
        .from("companies")
        .select("id,document_number")
        .eq("id", companyId)
        .maybeSingle();

    if (companyError || !company) {
        throw new Error("Empresa emissora não encontrada para envio da CC-e.");
    }

    const issuerCnpj = onlyDigits(company.document_number);
    if (issuerCnpj.length !== 14) {
        throw new Error("CNPJ da empresa emissora inválido para envio da CC-e.");
    }

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

    try {
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
