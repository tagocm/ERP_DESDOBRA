import { logger } from "@/lib/logger";

type SupabaseLike = any;

export interface ResolvedNfeArtifacts {
    xml: string;
    companyId: string;
    nfeKey: string | null;
    nfeNumber: string | null;
    nfeSeries: string | null;
    documentNumber: string | null;
}

function isExpectedCompanyAssetPath(path: string, companyId: string): boolean {
    const prefixes = [`companies/${companyId}/`, `${companyId}/`];
    return prefixes.some((p) => path.startsWith(p));
}

function looksLikeXml(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return trimmed.startsWith("<") && (
        trimmed.includes("<NFe") ||
        trimmed.includes("<nfeProc") ||
        trimmed.includes("<enviNFe")
    );
}

function getXmlPathFromDetails(details: any): string | null {
    if (!details || typeof details !== "object") return null;
    return (
        details?.artifacts?.nfe_proc ||
        details?.artifacts?.signed_xml ||
        details?.artifacts?.xml ||
        details?.xml_url ||
        null
    );
}

export async function resolveNfeArtifactsById(
    supabase: SupabaseLike,
    ctxCompanyId: string,
    id: string
): Promise<ResolvedNfeArtifacts> {
    let details: any | null = null;
    let documentId: string | null = null;
    let nfeKey: string | null = null;
    let sourceCompanyId: string | null = null;
    let nfeNumber: string | null = null;
    let nfeSeries: string | null = null;
    let xmlInline: string | null = null;

    const { data: emissionRecord, error: emissionError } = await supabase
        .from("nfe_emissions")
        .select("id, company_id, sales_document_id, access_key, status, numero, serie, draft_snapshot, xml_nfe_proc, xml_signed, xml_unsigned, xml_sent")
        .eq("id", id)
        .eq("company_id", ctxCompanyId)
        .maybeSingle();

    if (emissionError) {
        logger.warn("[NFE Artifacts] nfe_emissions lookup error:", emissionError);
    }

    if (emissionRecord) {
        documentId = emissionRecord.sales_document_id || null;
        nfeKey = emissionRecord.access_key || null;
        sourceCompanyId = emissionRecord.company_id || null;
        nfeNumber = emissionRecord.numero || null;
        nfeSeries = emissionRecord.serie || null;
        details = emissionRecord.draft_snapshot || null;
        const inlineCandidates = [
            emissionRecord.xml_nfe_proc,
            emissionRecord.xml_signed,
            emissionRecord.xml_unsigned,
            emissionRecord.xml_sent,
            emissionRecord?.draft_snapshot?.xml_nfe_proc,
            emissionRecord?.draft_snapshot?.xml_signed,
            emissionRecord?.draft_snapshot?.xml_unsigned,
            emissionRecord?.draft_snapshot?.xml_sent,
        ];
        xmlInline = inlineCandidates.find((candidate) => looksLikeXml(candidate)) || null;
    } else {
        const { data: nfeRecord, error: nfeError } = await supabase
            .from("sales_document_nfes")
            .select("document_id, nfe_key, nfe_number, nfe_series, details, draft_snapshot, status, document:sales_documents!inner(company_id)")
            .eq("id", id)
            .eq("document.company_id", ctxCompanyId)
            .maybeSingle();

        if (nfeError || !nfeRecord) {
            throw new Error(nfeError?.message || "NF-e record not found");
        }

        const snapshot = nfeRecord.draft_snapshot as any;
        details = (nfeRecord.details as any) || snapshot || null;
        documentId = nfeRecord.document_id || null;
        nfeKey = nfeRecord.nfe_key || null;
        nfeNumber = nfeRecord.nfe_number ? String(nfeRecord.nfe_number) : null;
        nfeSeries = nfeRecord.nfe_series ? String(nfeRecord.nfe_series) : null;
        sourceCompanyId = (Array.isArray((nfeRecord as any).document)
            ? (nfeRecord as any).document[0]?.company_id
            : (nfeRecord as any).document?.company_id) || null;
        const inlineCandidates = [
            snapshot?.xml_nfe_proc,
            snapshot?.xml_signed,
            snapshot?.xml_unsigned,
            snapshot?.xml_sent,
            snapshot?.signed_xml,
            snapshot?.unsigned_xml,
        ];
        xmlInline = inlineCandidates.find((candidate) => looksLikeXml(candidate)) || xmlInline;
    }

    let xml: string | null = xmlInline;

    if (!xml) {
        let xmlPath = getXmlPathFromDetails(details);

        if (!xmlPath && (documentId || nfeKey)) {
            const legacyQuery = supabase
                .from("sales_document_nfes")
                .select("document_id, nfe_key, details, draft_snapshot, document:sales_documents!inner(company_id)")
                .eq("document.company_id", ctxCompanyId)
                .limit(1);

            const legacyResult = documentId
                ? await legacyQuery.eq("document_id", documentId).maybeSingle()
                : await legacyQuery.eq("nfe_key", nfeKey).maybeSingle();

            if (legacyResult?.data && !legacyResult?.error) {
                const legacyDetails = legacyResult.data.details as any;
                const legacySnapshot = (legacyResult.data as any).draft_snapshot as any;
                const legacyInlineCandidates = [
                    legacySnapshot?.xml_nfe_proc,
                    legacySnapshot?.xml_signed,
                    legacySnapshot?.xml_unsigned,
                    legacySnapshot?.xml_sent,
                    legacySnapshot?.signed_xml,
                    legacySnapshot?.unsigned_xml,
                ];
                xmlInline = legacyInlineCandidates.find((candidate) => looksLikeXml(candidate)) || xmlInline;
                xmlPath = getXmlPathFromDetails(legacyDetails) || getXmlPathFromDetails(legacySnapshot);
                if (xmlPath) {
                    details = legacyDetails || legacySnapshot;
                    documentId = legacyResult.data.document_id || documentId;
                    nfeKey = legacyResult.data.nfe_key || nfeKey;
                    const legacyDoc = Array.isArray((legacyResult.data as any).document)
                        ? (legacyResult.data as any).document[0]
                        : (legacyResult.data as any).document;
                    sourceCompanyId = legacyDoc?.company_id || sourceCompanyId;
                }
            }
        }

        if (!xmlPath && xmlInline) {
            xml = xmlInline;
        }

        if (!xmlPath) {
            if (!xml) {
                throw new Error("No XML artifact path in NFe details");
            }
        } else {
            if (typeof xmlPath === "string" && !xmlPath.startsWith("http") && !isExpectedCompanyAssetPath(xmlPath, ctxCompanyId)) {
                throw new Error("Invalid XML storage path");
            }

            const protocolPath = details?.artifacts?.protocol;
            let protocolXml: string | null = null;

            if (protocolPath) {
                try {
                    if (typeof protocolPath === "string" && !protocolPath.startsWith("http") && !isExpectedCompanyAssetPath(protocolPath, ctxCompanyId)) {
                        throw new Error("Invalid protocol path");
                    }

                    const { data: protData, error: protErr } = await supabase
                        .storage
                        .from("company-assets")
                        .download(protocolPath);

                    if (!protErr && protData) {
                        protocolXml = await protData.text();
                    }
                } catch (error) {
                    logger.warn("[NFE Artifacts] protocol download error:", error);
                }
            }

            const { data: xmlData, error: xmlError } = await supabase.storage
                .from("company-assets")
                .download(xmlPath);

            if (xmlError || !xmlData) {
                throw new Error(xmlError?.message || "Storage download failed");
            }

            xml = await xmlData.text();

            const isNfeProc = (xml as string).includes("<nfeProc");
            if (!isNfeProc && protocolXml && protocolXml.includes("<protNFe")) {
                const cleanNFe = (xml as string).replace(/<\?xml[^>]*\?>/g, "").trim();
                const cleanProtocol = protocolXml.replace(/<\?xml[^>]*\?>/g, "").trim();
                xml = `<?xml version="1.0" encoding="UTF-8"?>\n<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">\n${cleanNFe}\n${cleanProtocol}\n</nfeProc>`;
            }
        }
    }

    if (!xml) {
        throw new Error("XML not found");
    }

    const companyId = sourceCompanyId || ctxCompanyId;

    let documentNumber: string | null = null;
    if (documentId) {
        try {
            const { data: docRecord } = await supabase
                .from("sales_documents")
                .select("document_number, company_id")
                .eq("id", documentId)
                .eq("company_id", ctxCompanyId)
                .single();

            documentNumber = docRecord?.document_number ? String(docRecord.document_number) : null;
        } catch {
            // ignore metadata fetch error
        }
    }

    return {
        xml,
        companyId,
        nfeKey,
        nfeNumber,
        nfeSeries,
        documentNumber,
    };
}
