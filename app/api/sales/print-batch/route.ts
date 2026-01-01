
import { NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";
import { renderOrderA4Html } from "@/lib/templates/print/order-a4";
import { generatePdfFromHtml } from "@/lib/print/pdf-generator";
import archiver from 'archiver';

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

        // 1. Fetch Data
        // Needs deep nesting: order -> items -> product, order -> client
        const { data: orders, error: fetchError } = await supabase
            .from('sales_documents')
            .select(`
                *,
                client:organizations!client_id (*),
                items:sales_document_items (
                    *,
                    product:items (*)
                )
            `)
            .in('id', ids);

        if (fetchError || !orders || orders.length === 0) {
            console.error('Error fetching orders:', fetchError);
            return NextResponse.json({ error: 'Erro ao buscar dados dos pedidos.' }, { status: 500 });
        }

        // Get tenant company info (assuming single tenant context or pulling from first order's owner logic)
        // For now, simpler approach: fetch the company of the logged user or the first found organizational unit
        // Or fetch "My Company" details.
        // Let's optimize: fetch current user's org.
        const { data: { user } } = await supabase.auth.getUser();

        // Fallback company data if "my company" fetch is complex here. 
        // Ideally we fetch from 'organizations' where is_owner = true or similar.
        // Let's try fetching the organization related to the order (emitter).
        // If order has no emitter field, we assume a default.
        // Let's use a Dummy Company Object if we can't easily find the "Sender/Emitente" without more DB queries.
        // Or better: the `sales_documents` likely belongs to the tenant.

        const companyData = {
            trade_name: "MARTIGRAN - MÁRMORES E GRANITOS",
            legal_name: "MARTIGRAN LTDA",
            document: "00.000.000/0001-00",
            address: "Rua Exemplo, 123 - Cidade/UF"
            // In real app, fetch from 'companies' table or 'settings'
        };

        console.log(`Generating files for ${orders.length} orders. Mode: ${mode}`);

        if (mode === 'zip') {
            // Generate individual PDFs
            const pdfFiles: { filename: string, buffer: Buffer }[] = [];

            for (const order of orders) {
                const html = renderOrderA4Html({
                    company: companyData,
                    order,
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

    } catch (error: any) {
        console.error('Batch print error:', error);
        return NextResponse.json({
            error: 'Falha durante geração dos arquivos.',
            details: error.message
        }, { status: 500 });
    }
}
