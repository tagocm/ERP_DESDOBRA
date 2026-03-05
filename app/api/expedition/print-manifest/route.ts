import { NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";
import { renderOrderA4Html } from "@/lib/templates/print/order-a4";
import { generatePdfFromHtml } from "@/lib/print/pdf-generator";
import { logger } from '@/lib/logger';

interface DeliveryItemRow {
    sales_document_item_id: string | null;
    qty_delivered: number | null;
}

interface DeliveryRow {
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    items?: DeliveryItemRow[] | null;
}

interface SalesOrderItemRow {
    id: string;
    quantity: number | null;
    unit_price: number | null;
    total_amount: number | null;
    notes?: string | null;
    item_id?: string | null;
    packaging?: { label?: string | null } | null;
    product?: { uom?: string | null; un?: string | null } | null;
    balance?: number;
    delivered?: number;
}

interface RouteOrderPartialPayloadItem {
    orderItemId?: string | null;
    itemId?: string | null;
    qtyLoaded?: number | null;
}

interface RouteOrderRow {
    loading_status?: string | null;
    partial_payload?: { items?: RouteOrderPartialPayloadItem[] | null } | null;
}

interface DeliveryEventPrint {
    date: string | null;
    seal: 'P' | 'T';
    status: string;
}

function normalizeSealFromStatus(status: string | null): 'P' | 'T' | null {
    const normalized = String(status || '').toLowerCase();
    if (!normalized) return null;

    if (['delivered_partial', 'returned_partial', 'partial', 'parcial'].includes(normalized)) {
        return 'P';
    }
    if (['delivered', 'returned_total', 'entregue', 'total'].includes(normalized)) {
        return 'T';
    }

    return null;
}

function calculateOrderItemBalances(items: SalesOrderItemRow[], deliveries: DeliveryRow[]): SalesOrderItemRow[] {
    const deliveredMap = new Map<string, number>();

    for (const delivery of deliveries) {
        const status = String(delivery.status || '').toLowerCase();
        if (!['delivered', 'delivered_partial', 'returned_partial', 'returned_total', 'entregue', 'parcial', 'total'].includes(status)) {
            continue;
        }

        for (const deliveredItem of delivery.items ?? []) {
            const itemId = deliveredItem.sales_document_item_id;
            if (!itemId) continue;

            const current = deliveredMap.get(itemId) ?? 0;
            deliveredMap.set(itemId, current + Number(deliveredItem.qty_delivered || 0));
        }
    }

    return items.map((item) => {
        const itemQty = Number(item.quantity || 0);
        const deliveredQty = deliveredMap.get(item.id) ?? 0;

        return {
            ...item,
            delivered: deliveredQty,
            balance: Math.max(0, itemQty - deliveredQty),
        };
    });
}

function buildDeliveryEventsForPrint(items: SalesOrderItemRow[], deliveries: DeliveryRow[]): DeliveryEventPrint[] {
    const totalOrderedQty = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    let cumulativeDeliveredQty = 0;

    const sortedDeliveries = [...deliveries].sort((a, b) => {
        const aTime = new Date(a.created_at || a.updated_at || 0).getTime();
        const bTime = new Date(b.created_at || b.updated_at || 0).getTime();
        return aTime - bTime;
    });

    const events: DeliveryEventPrint[] = [];

    for (const delivery of sortedDeliveries) {
        const status = String(delivery.status || '').toLowerCase();
        if (!['delivered', 'delivered_partial', 'returned_partial', 'returned_total', 'entregue', 'parcial', 'total'].includes(status)) {
            continue;
        }

        const deliveredQty = (delivery.items ?? []).reduce(
            (acc, deliveredItem) => acc + Number(deliveredItem.qty_delivered || 0),
            0
        );
        cumulativeDeliveredQty += deliveredQty;

        const sealFromStatus = normalizeSealFromStatus(status);
        const inferredSeal: 'P' | 'T' = totalOrderedQty > 0 && cumulativeDeliveredQty < totalOrderedQty ? 'P' : 'T';
        const seal = sealFromStatus === 'T' && inferredSeal === 'P' ? 'P' : (sealFromStatus ?? inferredSeal);

        events.push({
            date: delivery.updated_at || delivery.created_at,
            seal,
            status,
        });
    }

    return events;
}

function resolveLoadedQuantity(routeOrder: RouteOrderRow, item: SalesOrderItemRow): number {
    const baseQty = Number(item.balance ?? item.quantity ?? 0);
    const status = String(routeOrder.loading_status || '').toLowerCase();
    const partialItems = routeOrder.partial_payload?.items;

    if (status === 'loaded') return Math.max(0, baseQty);
    if (status === 'not_loaded' || status === 'pending') return 0;

    if (status === 'partial' && Array.isArray(partialItems)) {
        const hit = partialItems.find((entry: any) =>
            entry?.orderItemId === item.id ||
            entry?.itemId === item.id
        );
        const qtyLoaded = Number(hit?.qtyLoaded ?? 0);
        if (!Number.isFinite(qtyLoaded)) return 0;
        return Math.max(0, Math.min(baseQty, qtyLoaded));
    }

    return 0;
}

function extractBody(html: string): string {
    return html.match(/<body>([\s\S]*)<\/body>/i)?.[1] || html;
}

function inferMimeType(path: string): string {
    const normalized = path.toLowerCase();
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
    if (normalized.endsWith('.webp')) return 'image/webp';
    if (normalized.endsWith('.svg')) return 'image/svg+xml';
    if (normalized.endsWith('.gif')) return 'image/gif';
    return 'image/png';
}

function normalizeLogoPath(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            const marker = '/company-assets/';
            const idx = url.pathname.indexOf(marker);
            if (idx === -1) return null;
            return decodeURIComponent(url.pathname.slice(idx + marker.length));
        } catch {
            return null;
        }
    }

    if (trimmed.startsWith('company-assets/')) {
        return trimmed.slice('company-assets/'.length);
    }

    return trimmed;
}

export async function POST(request: Request) {
    try {
        const { routeId } = await request.json();
        if (!routeId) {
            return NextResponse.json({ error: 'Rota não informada.' }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: route, error: routeError } = await supabase
            .from('delivery_routes')
            .select(`
                id, company_id, name, scheduled_date,
                orders:delivery_route_orders(
                    id, loading_status, partial_payload, sales_document_id,
                    sales_order:sales_documents(
                        id, document_number, date_issued, status_commercial, status_logistic,
                        total_amount, discount_amount, freight_amount, internal_notes, delivery_address_json,
                        deliveries:deliveries(
                            status,
                            created_at,
                            updated_at,
                            items:delivery_items(
                                sales_document_item_id,
                                qty_delivered
                            )
                        ),
                        client:organizations!client_id(
                            id, trade_name, legal_name, document_number,
                            addresses(*)
                        ),
                        items:sales_document_items(
                            id, item_id, quantity, unit_price, total_amount, notes,
                            packaging:item_packaging(id, label, qty_in_base),
                            product:items!fk_sales_item_product(id, name, sku, uom)
                        )
                    )
                )
            `)
            .eq('id', routeId)
            .single();

        if (routeError || !route) {
            return NextResponse.json({ error: 'Rota não encontrada.' }, { status: 404 });
        }

        const routeOrderIds = (route.orders || []).map((ro: any) => ro.sales_document_id).filter(Boolean);
        const financialEntriesByOrder = new Map<string, any[]>();
        const financialEventEntriesByOrder = new Map<string, any[]>();

        if (routeOrderIds.length > 0) {
            const { data: arTitles } = await supabase
                .from('ar_titles')
                .select(`
                    sales_document_id,
                    installments:ar_installments(
                        installment_number,
                        due_date,
                        amount_original,
                        amount_open,
                        status,
                        payment_method
                    )
                `)
                .in('sales_document_id', routeOrderIds);

            for (const title of arTitles || []) {
                const docId = (title as any).sales_document_id as string;
                if (!docId) continue;
                const rows = Array.isArray((title as any).installments) ? (title as any).installments : [];
                const prev = financialEntriesByOrder.get(docId) || [];
                financialEntriesByOrder.set(docId, [...prev, ...rows]);
            }

            const { data: financialEvents } = await supabase
                .from('financial_events')
                .select(`
                    origin_id,
                    status,
                    installments:financial_event_installments(
                        installment_number,
                        due_date,
                        amount,
                        payment_method
                    )
                `)
                .eq('origin_type', 'SALE')
                .eq('direction', 'AR')
                .in('origin_id', routeOrderIds)
                .neq('status', 'rejected');

            for (const ev of financialEvents || []) {
                const docId = (ev as any).origin_id as string;
                if (!docId) continue;
                const rows = Array.isArray((ev as any).installments) ? (ev as any).installments : [];
                const normalizedRows = rows.map((inst: any) => ({
                    installment_number: inst.installment_number,
                    due_date: inst.due_date,
                    amount_original: Number(inst.amount || 0),
                    amount_open: Number(inst.amount || 0),
                    payment_method: inst.payment_method,
                    status: String((ev as any).status || 'pending').toUpperCase()
                }));
                const prev = financialEventEntriesByOrder.get(docId) || [];
                financialEventEntriesByOrder.set(docId, [...prev, ...normalizedRows]);
            }
        }

        let companyData = {
            trade_name: "",
            legal_name: "",
            document: "",
            address: "",
            address_street: "",
            address_number: "",
            address_neighborhood: "",
            address_city: "",
            address_state: "",
            website: "",
            phone: "",
            logo_url: null as string | null
        };

        const { data: settings } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company_id', route.company_id)
            .single();

        if (settings) {
            const parts = [
                settings.address_street,
                settings.address_number,
                settings.address_complement,
                settings.address_neighborhood,
                settings.address_city,
                settings.address_state
            ].filter(Boolean);
            const address = parts.join(', ');

            let logoDataUri: string | null = null;
            const rawLogoPath = settings.logo_path as string | null;
            if (rawLogoPath) {
                try {
                    const normalizedPath = normalizeLogoPath(rawLogoPath);
                    if (normalizedPath) {
                        const { data: blob, error: downloadError } = await supabase.storage
                            .from('company-assets')
                            .download(normalizedPath);

                        if (!downloadError && blob) {
                            const buffer = Buffer.from(await blob.arrayBuffer());
                            const base64 = buffer.toString('base64');
                            const mime = inferMimeType(normalizedPath);
                            logoDataUri = `data:${mime};base64,${base64}`;
                        }
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    logger.warn('[expedition/print-manifest] Failed processing logo (non-blocking)', { message });
                }

                if (!logoDataUri && /^https?:\/\//i.test(rawLogoPath)) {
                    logoDataUri = rawLogoPath;
                }
            }

            companyData = {
                trade_name: (settings.trade_name || settings.legal_name || "").toUpperCase(),
                legal_name: (settings.legal_name || "").toUpperCase(),
                document: settings.cnpj || "",
                address,
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

        const printableOrders = (route.orders || [])
            .map((routeOrder: any) => {
                const order = routeOrder.sales_order;
                if (!order) return null;

                const originalItems = Array.isArray(order.items) ? (order.items as SalesOrderItemRow[]) : [];
                const deliveries = Array.isArray(order.deliveries) ? (order.deliveries as DeliveryRow[]) : [];
                const itemsWithBalance = calculateOrderItemBalances(originalItems, deliveries);
                const deliveryEvents = buildDeliveryEventsForPrint(originalItems, deliveries);

                const loadedItems = itemsWithBalance
                    .map((item) => {
                        const loadedQty = resolveLoadedQuantity(routeOrder, item);
                        if (loadedQty <= 0) return null;

                        return {
                            ...item,
                            quantity: loadedQty,
                            total_amount: loadedQty * Number(item.unit_price || 0),
                            product: {
                                ...item.product,
                                un: item.product?.uom || item.product?.un || 'UN'
                            }
                        };
                    })
                    .filter((item) => item !== null);

                if (loadedItems.length === 0) return null;

                let clientAddress = "";
                const deliveryAddr = order.delivery_address_json;
                if (deliveryAddr && typeof deliveryAddr === 'object') {
                    clientAddress = `${deliveryAddr.street || ''}, ${deliveryAddr.number || ''} - ${deliveryAddr.neighborhood || ''} - ${deliveryAddr.city || ''}/${deliveryAddr.state || ''}`;
                } else if (order.client?.addresses?.length > 0) {
                    const addr = order.client.addresses[0];
                    clientAddress = `${addr.street || ''}, ${addr.number || ''} - ${addr.neighborhood || ''} - ${addr.city || ''}/${addr.state || ''}`;
                }

                const totalItems = loadedItems.reduce((acc: number, item: any) => acc + Number(item.total_amount || 0), 0);
                const discountAmount = Number(order.discount_amount || 0);
                const freightAmount = Number(order.freight_amount || 0);
                const computedTotal = Math.max(0, totalItems - discountAmount + freightAmount);

                return {
                    order: {
                        ...order,
                        total_amount: computedTotal,
                        discount_amount: discountAmount,
                        freight_amount: freightAmount,
                        client_address_resolved: clientAddress,
                        loading_status: routeOrder.loading_status,
                        is_partial_order: routeOrder.loading_status === 'partial',
                        delivery_events: deliveryEvents,
                        financial_entries:
                            (financialEntriesByOrder.get(order.id)?.length
                                ? financialEntriesByOrder.get(order.id)
                                : financialEventEntriesByOrder.get(order.id)) || []
                    },
                    items: loadedItems
                };
            })
            .filter(Boolean) as Array<{ order: any; items: any[] }>;

        if (printableOrders.length === 0) {
            return NextResponse.json({ error: 'Nenhum pedido com quantidade carregada para imprimir.' }, { status: 400 });
        }

        const orderHtmls = printableOrders.map(({ order, items }) =>
            renderOrderA4Html({
                company: companyData,
                order,
                items
            })
        );

        const styleMatch = orderHtmls[0].match(/<style>([\s\S]*)<\/style>/i);
        const style = styleMatch ? styleMatch[1] : '';
        const bodies = orderHtmls.map(extractBody);
        const orderPages = bodies
            .map((bodyHtml) => `<section class="order-page">${bodyHtml}</section>`)
            .join('');

        const combinedHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    ${style}
                    body {
                        display: block !important;
                        min-height: auto !important;
                        margin: 0;
                        padding: 0;
                    }
                    .order-page {
                        min-height: calc(297mm - 20mm);
                        display: flex;
                        flex-direction: column;
                        box-sizing: border-box;
                        break-after: page;
                        page-break-after: always;
                    }
                    .order-page:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }
                </style>
            </head>
            <body>
                ${orderPages}
            </body>
            </html>
        `;

        const pdfBuffer = await generatePdfFromHtml(combinedHtml);

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="romaneio_rota_${route.name || route.id}.pdf"`
            }
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[expedition/print-manifest] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Falha ao gerar romaneio.' : message },
            { status: 500 }
        );
    }
}
