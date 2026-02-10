
import { NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";
import { renderOrderA4Html } from "@/lib/templates/print/order-a4";
import { generatePdfFromHtml } from "@/lib/print/pdf-generator";
import archiver from 'archiver';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

// Helper to zip buffers
function zipPdfs(files: { filename: string, buffer: Buffer }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('error', (err) => reject(err));
        archive.on('end', () => resolve(Buffer.concat(chunks)));

        // Begin packing
        files.forEach(file => {
            archive.append(file.buffer, { name: file.filename });
        });

        archive.finalize();
    });
}

export async function POST(request: Request) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 10, windowMs: 60_000 }
            : { limit: 100, windowMs: 60_000 };
        const limit = rateLimit(request, { key: 'sales-print-batch', ...limitConfig });
        if (!limit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode') || 'pdf'; // 'zip' or 'pdf'

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Nenhum pedido selecionado.' }, { status: 400 });
        }

        if (ids.length > 50) {
            return NextResponse.json({ error: 'Limite de 50 pedidos excedido.' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Fetch Data with Deep Relations (Client Address)
        const { data: orders, error: fetchError } = await supabase
            .from('sales_documents')
            .select(`
                *,
                client:organizations!client_id (
                    *,
                    addresses (*)
                ),
                items:sales_document_items (
                    *,
                    product:items!fk_sales_item_product (*)
                )
            `)
            .in('id', ids);

        if (fetchError || !orders || orders.length === 0) {
            logger.error('[sales/print-batch] Error fetching orders', {
                code: fetchError?.code,
                message: fetchError?.message
            });
            return NextResponse.json({ error: 'Erro ao buscar dados dos pedidos.' }, { status: 500 });
        }

        // 1.5 Fetch Actual Company Data & Process Logo
        const companyId = orders[0]?.company_id;
        let companyData = {
            trade_name: "MARTIGRAN - MÁRMORES E GRANITOS",
            legal_name: "MARTIGRAN LTDA",
            document: "00.000.000/0001-00",
            address: "Dados da Empresa não encontrados",
            address_street: "",
            address_number: "",
            address_neighborhood: "",
            address_city: "",
            address_state: "",
            website: "",
            phone: "",
            logo_url: null as string | null
        };

        if (companyId) {
            const { data: settings } = await supabase
                .from('company_settings')
                .select('*')
                .eq('company_id', companyId)
                .single();

            if (settings) {
                // Address Construction
                const parts = [
                    settings.address_street,
                    settings.address_number,
                    settings.address_complement,
                    settings.address_neighborhood,
                    settings.address_city,
                    settings.address_state
                ].filter(Boolean);
                const address = parts.join(', ');

                // Logo Processing: Download and convert to Base64 to ensure it renders in PDF
                let logoDataUri = null;
                if (settings.logo_path) {
                    try {
                        const { data: blob, error: downloadError } = await supabase.storage
                            .from('company-assets')
                            .download(settings.logo_path);

                        if (!downloadError && blob) {
                            const buffer = Buffer.from(await blob.arrayBuffer());
                            const base64 = buffer.toString('base64');
                            // Detect mime type simple (assume png/jpg based on logic, or default to png)
                            const mime = settings.logo_path.endsWith('.jpg') || settings.logo_path.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
                            logoDataUri = `data:${mime};base64,${base64}`;
                        } else {
                            // Fallback to public URL (risky for PDF generator if network blocked)
                            const { data } = supabase.storage.from('company-assets').getPublicUrl(settings.logo_path);
                            // But we prefer null if download failed to avoid broken image icon usually
                            // logoDataUri = data.publicUrl;
                        }
                    } catch (e) {
                        const message = e instanceof Error ? e.message : 'Unknown error';
                        logger.warn('[sales/print-batch] Failed processing logo for PDF (non-blocking)', { message });
                    }
                }

                companyData = {
                    trade_name: (settings.trade_name || settings.legal_name || "").toUpperCase(),
                    legal_name: (settings.legal_name || "").toUpperCase(),
                    document: settings.cnpj || "",
                    address: address,
                    address_street: settings.address_street || "",
                    address_number: settings.address_number || "",
                    address_neighborhood: settings.address_neighborhood || "",
                    address_city: settings.address_city || "",
                    address_state: settings.address_state || "",
                    website: settings.website || "",
                    phone: settings.phone || "",
                    logo_url: logoDataUri
                };
            }
        }

        logger.info('[sales/print-batch] Generating batch files', { count: orders.length, mode });

        if (mode === 'zip') {
            // Generate individual PDFs
            const pdfFiles: { filename: string, buffer: Buffer }[] = [];

            for (const order of orders) {
                // Resolved Client Address
                let clientAddr = "";
                const deliveryAddr = order.delivery_address_json; // If saved snapshot exists
                if (deliveryAddr && typeof deliveryAddr === 'object') {
                    clientAddr = `${deliveryAddr.street || ''}, ${deliveryAddr.number || ''} - ${deliveryAddr.neighborhood || ''} - ${deliveryAddr.city || ''}/${deliveryAddr.state || ''}`;
                } else if (order.client?.addresses && order.client.addresses.length > 0) {
                    // Pick first address or specific type
                    const addr = order.client.addresses[0];
                    clientAddr = `${addr.street || ''}, ${addr.number || ''} - ${addr.neighborhood || ''} - ${addr.city || ''}/${addr.state || ''}`;
                }

                const html = renderOrderA4Html({
                    company: companyData,
                    order: { ...order, client_address_resolved: clientAddr },
                    items: order.items || []
                });

                const pdfBuffer = await generatePdfFromHtml(html);
                const safeName = `PEDIDO_${order.document_number}_${order.client?.trade_name?.replace(/[^a-z0-9]/gi, '_') || 'CLI'}.pdf`;

                pdfFiles.push({ filename: safeName, buffer: pdfBuffer });
            }

            const zipBuffer = await zipPdfs(pdfFiles);

            return new NextResponse(zipBuffer as any, {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="pedidos_batch.zip"`,
                }
            });

        } else {
            // MODE = PDF (Merge/Concat)
            // Strategy: Concatenate HTMLs with page breaks
            let combinedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; }
                .page-break { page-break-before: always; }
              </style>
            </head>
            <body>
            `;

            const orderHtmls = orders.map(order =>
                renderOrderA4Html({
                    company: companyData,
                    order,
                    items: order.items || []
                })
            );

            // Need to strip <html><body> tags from individual render to safely concat?
            // Yes, renderOrderA4Html returns full HTML. We should optionally return just body content or 
            // use iframes? No, playwight renders full page.

            // BETTER STRATEGY FOR CONCAT PDF:
            // renderOrderA4Html inside loop returns FULL HTML.
            // Concatenating full HTMLs is invalid.
            // Let's manually strip <html><head><body> tags from the sub-templates?
            // Or better: Modify renderOrderA4Html to just return the inner content DIVs if we pass a flag?
            // Or just regex replace.

            // Let's do regex replace for Simplicity:
            const bodies = orderHtmls.map(h => {
                const bodyContent = h.match(/<body>([\s\S]*)<\/body>/i)?.[1] || h;
                // Add styles too?
                // The styles are in <head>. We need to collect styles once.
                return bodyContent;
            });

            // Extract style from first
            const styleMatch = orderHtmls[0].match(/<style>([\s\S]*)<\/style>/i);
            const style = styleMatch ? styleMatch[1] : '';

            combinedHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    ${style}
                    /* Override or ensure page break */
                    .page-break { break-before: page; page-break-before: always; display: block; height: 1px; width: 100%; }
                    .order-container { position: relative; }
                </style>
            </head>
            <body>
                ${bodies.join('<div class="page-break"></div>')}
            </body>
            </html>
            `;

            const pdfBuffer = await generatePdfFromHtml(combinedHtml);

            return new NextResponse(pdfBuffer as any, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="pedidos_consolidado.pdf"`,
                }
            });
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sales/print-batch] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Falha durante geração dos arquivos.' : message },
            { status: 500 }
        );
    }
}
