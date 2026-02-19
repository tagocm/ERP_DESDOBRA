import { logger } from "@/lib/logger";

// Use SupabaseClient type from the package if available, or any if not strictly needed for this file's logic to work at runtime.
// Ideally: import { SupabaseClient } from "@supabase/supabase-js";
// But to avoid "module not found" if dev deps are weird, we can use a looser type or imports from @/utils/supabase/server
// For now, let's allow 'any' for the client to prevent build-time TS errors if the specific generic is hard to satisfy without full project context.
type SupabaseClientLike = any;

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
    supabase: SupabaseClientLike,
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
    let xmlPathFromColumn: string | null = null;

    // 1. Try fetching from new standardized table (nfe_emissions)
    // IMPORTANT: Do NOT fetch draft_snapshot (column does not exist in this table)
    const { data: emissionRecord, error: emissionError } = await supabase
        .from("nfe_emissions")
        .select("id, company_id, sales_document_id, access_key, status, numero, serie, xml_nfe_proc, xml_signed, xml_unsigned, xml_sent")
        .eq("id", id)
        .eq("company_id", ctxCompanyId)
        .maybeSingle();

    if (emissionError) {
        // Critical: If error is anything other than "Row not found"
        logger.error("[NFE Artifacts] nfe_emissions query failed:", emissionError);
        throw new Error(`Database error resolving NFe: ${emissionError.message} (${emissionError.code})`);
    }

    if (emissionRecord) {
        // Success finding record in new table
        documentId = emissionRecord.sales_document_id || null;
        nfeKey = emissionRecord.access_key || null;
        sourceCompanyId = emissionRecord.company_id || null;
        nfeNumber = emissionRecord.numero || null;
        nfeSeries = emissionRecord.serie || null;

        // Priority Resolution for Inline XML
        const inlineCandidates = [
            emissionRecord.xml_nfe_proc, // 1. Final Authorized Proc (Best)
            emissionRecord.xml_signed,   // 2. Signed XML (Good)
            emissionRecord.xml_sent,     // 3. Sent Envelope (Ok)
            emissionRecord.xml_unsigned  // 4. Draft (Weak)
        ];

        xmlInline = inlineCandidates.find((candidate) => looksLikeXml(candidate)) || null;

        // NEW: If xml_signed exists but doesn't look like XML, it might be a PATH (e.g. "companies/...")
        // This handles cases where we store the path in the text column.
        if (!xmlInline) {
            const potentialPaths = [
                emissionRecord.xml_nfe_proc,
                emissionRecord.xml_signed,
                emissionRecord.xml_unsigned
            ];
            const foundPath = potentialPaths.find(p => typeof p === 'string' && p.length < 255 && !looksLikeXml(p) && p.includes('/'));
            if (foundPath) {
                xmlPathFromColumn = foundPath;
            }
        }

    } else {
        // 2. Fallback to Legacy Table (sales_document_nfes)
        // Only reached if emissionRecord is null (Not Found in new table)

        const { data: nfeRecord, error: nfeError } = await supabase
            .from("sales_document_nfes")
            .select("document_id, nfe_key, nfe_number, nfe_series, details, draft_snapshot, status, document:sales_documents!inner(company_id)")
            .eq("id", id)
            .eq("document.company_id", ctxCompanyId)
            .maybeSingle();

        if (nfeError || !nfeRecord) {
            // If not found in either, throw.
            throw new Error(nfeError?.message || "NF-e record not found");
        }

        // Legacy record found
        const snapshot = nfeRecord.draft_snapshot as any;
        details = (nfeRecord.details as any) || snapshot || null;
        documentId = nfeRecord.document_id || null;
        nfeKey = nfeRecord.nfe_key || null;
        nfeNumber = nfeRecord.nfe_number ? String(nfeRecord.nfe_number) : null;
        nfeSeries = nfeRecord.nfe_series ? String(nfeRecord.nfe_series) : null;

        // Handle joined company_id safely
        const docRelation = (nfeRecord as any).document;
        if (Array.isArray(docRelation)) {
            sourceCompanyId = docRelation[0]?.company_id || null;
        } else if (docRelation) {
            sourceCompanyId = docRelation.company_id || null;
        }

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

    // --- XML Resolution Logic (Common) ---

    let xml: string | null = xmlInline;
    let xmlPath = xmlPathFromColumn || getXmlPathFromDetails(details);

    if (!xml) {
        // If no inline XML and no path yet, try legacy double-check (only if we failed above)
        // This block is preserved from original for extreme robustness for legacy data structure variations

        if (!xmlPath && (documentId || nfeKey)) {
            // We only check legacy if we haven't successfully resolved anything yet.
            // If we found a record in nfe_emissions but it was empty, maybe check legacy table just in case? 
            // (Unlikely scenario but safe to keep if strictly typed).
            if (!xmlInline && !xmlPathFromColumn) {
                const legacyQuery = supabase
                    .from("sales_document_nfes")
                    .select("document_id, nfe_key, details, draft_snapshot, document:sales_documents!inner(company_id)")
                    .eq("document.company_id", ctxCompanyId)
                    .limit(1);

                const legacyResult = documentId
                    ? await legacyQuery.eq("document_id", documentId).maybeSingle()
                    : await legacyQuery.eq("nfe_key", nfeKey!).maybeSingle();

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

                    const fallbackInline = legacyInlineCandidates.find((candidate) => looksLikeXml(candidate));
                    if (fallbackInline) xml = fallbackInline; // Set directly to xml

                    const fallbackPath = getXmlPathFromDetails(legacyDetails) || getXmlPathFromDetails(legacySnapshot);
                    if (fallbackPath) {
                        xmlPath = fallbackPath;
                        details = legacyDetails || legacySnapshot;
                        // update context
                        const legacyDoc = Array.isArray((legacyResult.data as any).document)
                            ? (legacyResult.data as any).document[0]
                            : (legacyResult.data as any).document;
                        sourceCompanyId = legacyDoc?.company_id || sourceCompanyId;
                    }
                }
            }
        }

        if (!xmlPath && xml) {
            // we found inline xml in fallback
        } else if (xmlPath) {
            // We have a path, let's download
            if (typeof xmlPath === "string" && !xmlPath.startsWith("http") && !isExpectedCompanyAssetPath(xmlPath, ctxCompanyId)) {
                // Warning logic for unexpected paths?
                // For now, if it looks like a file path, we try to download.
                // logger.warn(`[NFE Artifacts] Unusual XML path: ${xmlPath}`);
            }

            const protocolPath = details?.artifacts?.protocol;
            let protocolXml: string | null = null;

            if (protocolPath) {
                try {
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
                if (xmlError?.statusCode === '404' || xmlError?.message?.includes('not found')) {
                    // If file missing but we have key, maybe we can fetch from SEFAZ? (Out of scope here)
                }
                throw new Error(xmlError?.message || `Storage download failed for XML at ${xmlPath}`);
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
        throw new Error("XML artifact not found. The NFe might be authorized but the XML file is missing or not linked.");
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
            // ignore
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
