import { NextRequest, NextResponse } from 'next/server';
import { generateDanfePdf } from '@/lib/danfe/pdfService';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseServer';

export const maxDuration = 60; // Allow sufficient time for Chromium launch

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let { xml, id } = body;

        if (!xml && !id) {
            return NextResponse.json({ error: 'XML or ID is required' }, { status: 400 });
        }

        // Declare companyId at top level for proper scope
        let companyId: string | undefined;
        const adminSupabase = createAdminClient();

        if (!xml && id) {
            console.log('[DANFE API] Fetching NFe by ID:', id);

            // Step 1: Get artifact paths from sales_document_nfes.details
            const { data: nfeRecord, error: nfeError } = await adminSupabase
                .from('sales_document_nfes')
                .select('document_id, nfe_key, details, status')
                .eq('id', id)
                .single();

            console.log('[DANFE API] NFe record lookup:', { error: nfeError, hasData: !!nfeRecord });

            if (nfeError || !nfeRecord) {
                console.error('[DANFE API] sales_document_nfes error:', nfeError);
                return NextResponse.json({
                    error: 'NF-e record not found',
                    details: nfeError?.message || 'No record in sales_document_nfes',
                    id
                }, { status: 404 });
            }

            // Step 2: Extract XML path from details (prefer nfeProc > signed > unsigned)
            const details = nfeRecord.details as any;
            const xmlPath = details?.artifacts?.nfe_proc || details?.artifacts?.signed_xml || details?.artifacts?.xml;

            console.log('[DANFE API] XML Path from details:', xmlPath);

            if (!xmlPath) {
                return NextResponse.json({
                    error: 'XML not found',
                    details: 'No XML artifact path in NFe details',
                    nfe_key: nfeRecord.nfe_key
                }, { status: 404 });
            }

            // Step 3: Download XML from storage
            try {
                // Try to get protocol as well to build full nfeProc
                const protocolPath = details?.artifacts?.protocol;
                let protocolXml: string | null = null;

                if (protocolPath) {
                    try {
                        const { data: protData, error: protErr } = await adminSupabase
                            .storage
                            .from('company-assets')
                            .download(protocolPath);

                        if (!protErr && protData) {
                            protocolXml = await protData.text();
                            console.log('[DANFE API] Protocol XML fetched');
                        }
                    } catch (protError) {
                        console.warn('[DANFE API] Could not fetch protocol, continuing without it:', protError);
                    }
                }

                const { data: xmlData, error: xmlError } = await adminSupabase.storage
                    .from('company-assets')
                    .download(xmlPath);

                if (xmlError || !xmlData) {
                    console.error('[DANFE API] Storage download error:', xmlError);
                    throw new Error(xmlError?.message || 'Storage download failed');
                }

                xml = await xmlData.text();
                console.log('[DANFE API] XML downloaded, length:', xml.length);

                // Extract company_id for logo
                try {
                    const { data: docRecord } = await adminSupabase
                        .from('sales_documents')
                        .select('company_id')
                        .eq('id', nfeRecord.document_id)
                        .single();

                    companyId = docRecord?.company_id;
                    console.log('[DANFE API] Company ID for logo:', companyId);
                } catch (e) {
                    console.warn('[DANFE API] Could not fetch company_id:', e);
                }

                // Step 4: Combine into nfeProc if we have separate NFe and Protocol
                // Check if XML is already nfeProc
                const isNfeProc = xml.includes('<nfeProc');

                if (!isNfeProc && protocolXml && protocolXml.includes('<protNFe')) {
                    console.log('[DANFE API] Assembling nfeProc on the fly...');
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
                        console.log('[DANFE API] nfeProc assembled successfully');
                    } catch (assemblyError) {
                        console.error('[DANFE API] Error assembling nfeProc:', assemblyError);
                    }
                }

            } catch (storageError: any) {
                console.error('[DANFE API] Storage exception:', storageError);
                return NextResponse.json({
                    error: 'Storage access failed',
                    details: storageError.message,
                    xml_path: xmlPath
                }, { status: 500 });
            }
        }

        // Generate PDF with better error handling
        try {
            console.log('[DANFE API] Generating PDF with companyId:', companyId);
            const pdfBuffer = await generateDanfePdf(xml, companyId);

            // Cast to any because NextResponse supports Buffer in Node.js runtime even if types strictly say BodyInit
            return new NextResponse(pdfBuffer as any, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'inline; filename="danfe.pdf"',
                },
            });
        } catch (pdfError: any) {
            console.error('[DANFE API] PDF Generation Error:', pdfError.message);
            console.error('[DANFE API] XML snippet:', xml.substring(0, 500));

            // Try to parse and show structure for debugging
            const debugInfo: any = { message: pdfError.message };
            try {
                const { XMLParser } = await import('fast-xml-parser');
                const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
                const parsed = parser.parse(xml);
                debugInfo.xmlStructure = {
                    rootKeys: Object.keys(parsed),
                    hasNfeProc: 'nfeProc' in parsed,
                    hasNFe: 'NFe' in parsed,
                    hasEnviNFe: 'enviNFe' in parsed
                };
            } catch {
                debugInfo.xmlStructure = 'Could not parse XML for debug';
            }

            return NextResponse.json({
                error: 'Failed to generate DANFE',
                details: pdfError.message,
                xml_preview: xml.substring(0, 200),
                debug: debugInfo
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('DANFE Generation Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate DANFE', details: error.message },
            { status: 500 }
        );
    }
}
