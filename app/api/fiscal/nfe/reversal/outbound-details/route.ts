export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabaseServer";
import { resolveEmissionForFiscalAction } from "@/lib/fiscal/nfe/resolve-emission";
import { OutboundReversalDetailsRequestSchema, OutboundReversalDetailsResponseSchema } from "@/lib/fiscal/nfe/reversal/schemas";
import { z } from "zod";

const SalesDocItemRowSchema = z.object({
    id: z.string().uuid(),
    quantity: z.number(),
    unit_price: z.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    product: z.object({
        id: z.string().uuid(),
        name: z.string(),
        sku: z.string().nullable().optional(),
    }).nullable().optional(),
}).passthrough();

const SalesDocSchema = z.object({
    id: z.string().uuid(),
    document_number: z.number().nullable().optional(),
    total_amount: z.number().nullable().optional(),
    date_issued: z.string().nullable().optional(),
    client: z.object({
        trade_name: z.string().nullable().optional(),
    }).nullable().optional(),
    items: z.array(SalesDocItemRowSchema).optional().default([]),
}).passthrough();

const NfeEmissionRowSchema = z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    sales_document_id: z.string().uuid().nullable().optional(),
    access_key: z.string(),
    status: z.string(),
    numero: z.union([z.number(), z.string()]).nullable().optional(),
    serie: z.union([z.number(), z.string()]).nullable().optional(),
    authorized_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
}).passthrough();

const ProductionProfileRowSchema = z.object({
    item_id: z.string().uuid(),
    is_produced: z.boolean().nullable().optional(),
}).passthrough();

function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

        const bodyUnknown: unknown = await req.json().catch(() => null);
        const body = OutboundReversalDetailsRequestSchema.parse(bodyUnknown);

        const { data: memberships, error: membershipError } = await supabase
            .from("company_members")
            .select("company_id")
            .eq("auth_user_id", user.id);

        if (membershipError) {
            return NextResponse.json({ error: "Falha ao validar vínculo com empresa." }, { status: 500 });
        }

        const companyIds = (memberships || []).map((m) => m.company_id).filter((id): id is string => typeof id === "string" && id.length > 0);
        if (companyIds.length === 0) return NextResponse.json({ error: "Usuário não vinculado a nenhuma empresa." }, { status: 403 });

        const admin = createAdminClient();
        const emission = await resolveEmissionForFiscalAction({
            admin,
            companyIds,
            payload: { emissionId: body.outboundEmissionId },
        });

        if (!emission) return NextResponse.json({ error: "NF-e não encontrada." }, { status: 404 });

        const { data: emissionRow, error: emissionError } = await admin
            .from("nfe_emissions")
            .select("id,company_id,sales_document_id,access_key,status,numero,serie,authorized_at,updated_at,created_at")
            .eq("id", emission.id)
            .eq("company_id", emission.company_id)
            .maybeSingle();

        if (emissionError) return NextResponse.json({ error: `Falha ao carregar NF-e: ${emissionError.message}` }, { status: 500 });
        if (!emissionRow) return NextResponse.json({ error: "NF-e não encontrada." }, { status: 404 });

        const emissionParsed = NfeEmissionRowSchema.parse(emissionRow);

        if (!emissionParsed.sales_document_id) {
            return NextResponse.json({ error: "NF-e sem pedido vinculado. Não é possível listar itens." }, { status: 400 });
        }

        const { data: orderRow, error: orderError } = await admin
            .from("sales_documents")
            .select(`
                id,
                document_number,
                total_amount,
                date_issued,
                client:organizations!client_id(trade_name),
                items:sales_document_items(
                    id,
                    quantity,
                    unit_price,
                    created_at,
                    product:items!fk_sales_item_product(id, name, sku)
                )
            `)
            .eq("id", emissionParsed.sales_document_id)
            .eq("company_id", emissionParsed.company_id)
            .maybeSingle();

        if (orderError) return NextResponse.json({ error: `Falha ao carregar pedido: ${orderError.message}` }, { status: 500 });
        if (!orderRow) return NextResponse.json({ error: "Pedido não encontrado para a NF-e." }, { status: 404 });

        const order = SalesDocSchema.parse(orderRow);
        const itemsSorted = [...(order.items || [])].sort((a, b) => {
            const ad = String(a.created_at || "");
            const bd = String(b.created_at || "");
            if (ad !== bd) return ad.localeCompare(bd);
            return a.id.localeCompare(b.id);
        });

        const itemIds = itemsSorted
            .map((it) => it.product?.id || null)
            .filter((v): v is string => typeof v === "string" && v.length > 0);

        const producedByItemId = new Map<string, boolean>();
        if (itemIds.length > 0) {
            const { data: prodRows, error: prodError } = await admin
                .from("item_production_profiles")
                .select("item_id,is_produced")
                .eq("company_id", emissionParsed.company_id)
                .in("item_id", itemIds);

            if (prodError) {
                return NextResponse.json({ error: `Falha ao consultar perfil de produção: ${prodError.message}` }, { status: 500 });
            }

            for (const row of prodRows || []) {
                const parsed = ProductionProfileRowSchema.safeParse(row);
                if (!parsed.success) continue;
                producedByItemId.set(parsed.data.item_id, Boolean(parsed.data.is_produced));
            }
        }

        const response = {
            emission: {
                id: emissionParsed.id,
                status: emissionParsed.status,
                accessKey: emissionParsed.access_key,
                numero: toNumberOrNull(emissionParsed.numero),
                serie: toNumberOrNull(emissionParsed.serie),
                authorizedAt: emissionParsed.authorized_at ?? null,
                issuedAt: emissionParsed.authorized_at ?? emissionParsed.updated_at ?? emissionParsed.created_at ?? null,
                documentNumber: order.document_number ?? null,
                clientName: order.client?.trade_name ?? null,
                totalAmount: order.total_amount ?? null,
            },
            items: itemsSorted.map((row, idx) => {
                const product = row.product;
                const itemId = product?.id || "";
                const unitPrice = row.unit_price ?? null;
                const total = unitPrice !== null ? unitPrice * row.quantity : null;
                return {
                    nItem: idx + 1,
                    salesDocumentItemId: row.id,
                    itemId,
                    name: product?.name || "Item",
                    sku: product?.sku ?? null,
                    quantity: row.quantity,
                    unitPrice,
                    total,
                    isProduced: itemId ? (producedByItemId.get(itemId) || false) : false,
                };
            }),
        };

        const validated = OutboundReversalDetailsResponseSchema.parse(response);
        return NextResponse.json(validated);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erro interno ao carregar dados de estorno.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

