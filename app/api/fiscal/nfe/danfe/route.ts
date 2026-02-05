import { NextRequest, NextResponse } from 'next/server';
import { generateDanfePdf } from '@/lib/danfe/pdfService';
import { logger } from "@/lib/logger";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api/response";

export const maxDuration = 60; // Allow sufficient time for Chromium launch

function isExpectedCompanyAssetPath(path: string, companyId: string): boolean {
    const prefixes = [`companies/${companyId}/`, `${companyId}/`];
    return prefixes.some((p) => path.startsWith(p));
}

export async function POST(req: NextRequest) {
    try {
        const limit = rateLimit(req, { key: "nfe-danfe", limit: 20, windowMs: 60_000 });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        const ctx = await resolveCompanyContext();
        const ctxCompanyId = ctx.companyId;
        const supabase = ctx.supabase;
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }

        const schema = z.object({
            xml: z.string().min(1).optional(),
            id: z.string().min(1).optional()
        }).refine((data) => data.xml || data.id, { message: 'XML ou ID é obrigatório' });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        let { xml, id } = parsed.data;

        // Declare companyId at top level for proper scope
        let companyId: string | undefined = ctxCompanyId;

        if (!xml && id) {
            logger.info('[DANFE API] Fetching NFe by ID:', id);

            let details: any | null = null;
            let documentId: string | null = null;
            let nfeKey: string | null = null;
            let sourceCompanyId: string | null = null;

            // Step 1: Try current source (nfe_emissions)
            const { data: emissionRecord, error: emissionError } = await supabase
                .from('nfe_emissions')
                .select('id, company_id, sales_document_id, access_key, draft_snapshot, status')
                .eq('id', id)
                .eq('company_id', ctxCompanyId)
                .maybeSingle();

            if (emissionError) {
                logger.warn('[DANFE API] nfe_emissions lookup error:', emissionError);
            }

            if (emissionRecord) {
                details = emissionRecord.draft_snapshot;
                documentId = emissionRecord.sales_document_id || null;
                nfeKey = emissionRecord.access_key || null;
                sourceCompanyId = emissionRecord.company_id || null;
            } else {
                // Step 2: Legacy source (sales_document_nfes)
                const { data: nfeRecord, error: nfeError } = await supabase
                    .from('sales_document_nfes')
                    .select('document_id, nfe_key, details, status, company_id')
                    .eq('id', id)
                    .eq('company_id', ctxCompanyId)
                    .maybeSingle();

                logger.info('[DANFE API] Legacy record lookup:', { error: nfeError, hasData: !!nfeRecord });

                if (nfeError || !nfeRecord) {
                    logger.error('[DANFE API] sales_document_nfes error:', nfeError);
                    return errorResponse(
                        "NF-e record not found",
                        404,
                        "NOT_FOUND",
                        { details: nfeError?.message || "No record in nfe_emissions or sales_document_nfes", id }
                    );
                }

                details = nfeRecord.details as any;
                documentId = nfeRecord.document_id || null;
                nfeKey = nfeRecord.nfe_key || null;
                sourceCompanyId = nfeRecord.company_id || null;
            }

            // Step 3: Extract XML path from details (prefer nfeProc > signed > unsigned)
            let xmlPath = details?.artifacts?.nfe_proc || details?.artifacts?.signed_xml || details?.artifacts?.xml;

            // Fallback: if coming from nfe_emissions without artifacts, try legacy by document_id or access_key
            if (!xmlPath && (documentId || nfeKey)) {
                const legacyQuery = supabase
                    .from('sales_document_nfes')
                    .select('document_id, nfe_key, details, status, company_id')
                    .eq('company_id', ctxCompanyId)
                    .limit(1);
                let legacyResult;
                if (documentId) {
                    legacyResult = await legacyQuery.eq('document_id', documentId).maybeSingle();
                } else if (nfeKey) {
                    legacyResult = await legacyQuery.eq('nfe_key', nfeKey).maybeSingle();
                }
                if (legacyResult?.data && !legacyResult?.error) {
                    const legacyDetails = legacyResult.data.details as any;
                    xmlPath = legacyDetails?.artifacts?.nfe_proc || legacyDetails?.artifacts?.signed_xml || legacyDetails?.artifacts?.xml;
                    if (xmlPath) {
                        details = legacyDetails;
                        documentId = legacyResult.data.document_id || documentId;
                        nfeKey = legacyResult.data.nfe_key || nfeKey;
                        sourceCompanyId = legacyResult.data.company_id || sourceCompanyId;
                        logger.info('[DANFE API] Fallback legacy artifacts resolved');
                    }
                }
            }

            logger.info('[DANFE API] XML Path from details:', xmlPath);

            if (!xmlPath) {
                return errorResponse(
                    "XML not found",
                    404,
                    "NOT_FOUND",
                    { details: "No XML artifact path in NFe details", nfe_key: nfeKey }
                );
            }

            if (typeof xmlPath === 'string' && !xmlPath.startsWith('http') && !isExpectedCompanyAssetPath(xmlPath, ctxCompanyId)) {
                return errorResponse("XML not found", 404, "NOT_FOUND");
            }

            // Step 3: Download XML from storage
            try {
                // Try to get protocol as well to build full nfeProc
                const protocolPath = details?.artifacts?.protocol;
                let protocolXml: string | null = null;

                if (protocolPath) {
                    try {
                        if (typeof protocolPath === 'string' && !protocolPath.startsWith('http') && !isExpectedCompanyAssetPath(protocolPath, ctxCompanyId)) {
                            throw new Error('Invalid protocol path');
                        }

                        const { data: protData, error: protErr } = await supabase
                            .storage
                            .from('company-assets')
                            .download(protocolPath);

                        if (!protErr && protData) {
                            protocolXml = await protData.text();
                            logger.info('[DANFE API] Protocol XML fetched');
                        }
                    } catch (protError) {
                        logger.warn('[DANFE API] Could not fetch protocol, continuing without it:', protError);
                    }
                }

                const { data: xmlData, error: xmlError } = await supabase.storage
                    .from('company-assets')
                    .download(xmlPath);

                if (xmlError || !xmlData) {
                    logger.error('[DANFE API] Storage download error:', xmlError);
                    throw new Error(xmlError?.message || 'Storage download failed');
                }

                xml = await xmlData.text();
                logger.info('[DANFE API] XML downloaded, length:', xml.length);

                // Extract company_id for logo
                try {
                    if (documentId) {
                        const { data: docRecord } = await supabase
                            .from('sales_documents')
                            .select('company_id')
                            .eq('id', documentId)
                            .eq('company_id', ctxCompanyId)
                            .single();

                        companyId = docRecord?.company_id || sourceCompanyId || ctxCompanyId;
                    } else {
                        companyId = sourceCompanyId || ctxCompanyId;
                    }
                    logger.info('[DANFE API] Company ID for logo:', companyId);
                } catch (e) {
                    logger.warn('[DANFE API] Could not fetch company_id:', e);
                }

                // Step 4: Combine into nfeProc if we have separate NFe and Protocol
                // Check if XML is already nfeProc
                const isNfeProc = xml.includes('<nfeProc');

                if (!isNfeProc && protocolXml && protocolXml.includes('<protNFe')) {
                    logger.info('[DANFE API] Assembling nfeProc on the fly...');
                    try {
                        // Clean headers
                        const cleanNFe = xml.replace(/<\?xml[^>]*\?>/g, '').trim();
                        const cleanProtocol = protocolXml.replace(/<\?xml[^>]*\?>/g, '').trim();

                        // Construct nfeProc
                        xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
${cleanNFe}
${cleanProtocol}
</nfeProc>`;
                        logger.info('[DANFE API] nfeProc assembled successfully');
                    } catch (assemblyError) {
                        logger.error('[DANFE API] Error assembling nfeProc:', assemblyError);
                    }
                }

            } catch (storageError: any) {
                logger.error('[DANFE API] Storage exception:', storageError);
                return errorResponse(
                    "Storage access failed",
                    500,
                    "STORAGE_ERROR",
                    { details: storageError.message, xml_path: xmlPath }
                );
            }
        }

        if (!xml) {
            return errorResponse("XML não encontrado", 404, "NOT_FOUND");
        }
        const xmlString = xml;

        // Generate PDF with better error handling
        try {
            logger.info('[DANFE API] Generating PDF with companyId:', companyId);
            let logoUrl: string | undefined;
            if (companyId) {
                const { data: settings } = await supabase
                    .from('company_settings')
                    .select('logo_path')
                    .eq('company_id', companyId)
                    .maybeSingle();

                const logoPath = settings?.logo_path;
                if (logoPath) {
                    if (logoPath.startsWith('http')) {
                        logoUrl = logoPath;
                    } else if (isExpectedCompanyAssetPath(logoPath, companyId)) {
                        const { data: signedUrlData } = await supabase.storage
                            .from('company-assets')
                            .createSignedUrl(logoPath, 3600);
                        logoUrl = signedUrlData?.signedUrl;
                    }
                }
            }

            const pdfBuffer = await generateDanfePdf(xmlString, companyId, logoUrl);

            // Cast to any because NextResponse supports Buffer in Node.js runtime even if types strictly say BodyInit
            return new NextResponse(pdfBuffer as any, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'inline; filename="danfe.pdf"',
                },
            });
        } catch (pdfError: any) {
            logger.error('[DANFE API] PDF Generation Error:', pdfError.message);

            // Try to parse and show structure for debugging
            const debugInfo: any = { message: pdfError.message };
            try {
                const { XMLParser } = await import('fast-xml-parser');
                const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
                const parsed = parser.parse(xmlString);
                debugInfo.xmlStructure = {
                    rootKeys: Object.keys(parsed),
                    hasNfeProc: 'nfeProc' in parsed,
                    hasNFe: 'NFe' in parsed,
                    hasEnviNFe: 'enviNFe' in parsed
                };
            } catch {
                debugInfo.xmlStructure = 'Could not parse XML for debug';
            }

            return errorResponse(
                "Failed to generate DANFE",
                500,
                "DANFE_ERROR",
                {
                    details: pdfError.message,
                    debug: debugInfo
                }
            );
        }
    } catch (error: any) {
        logger.error('DANFE Generation Error:', error);
        return errorResponse("Failed to generate DANFE", 500, "INTERNAL_ERROR", { details: error.message });
    }
}
