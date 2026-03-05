import { NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { generatePdfFromHtml } from "@/lib/print/pdf-generator";
import { renderWorkOrderA4Html } from "@/lib/templates/print/work-order-a4";
import { resolveCompanyLogoDataUri, resolveCompanyLogoUrl } from "@/lib/fiscal/nfe/logo-resolver";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH_IDS = 50;

type RelationMaybeArray<T> = T | T[] | null;

interface PrintBatchBody {
  ids: string[];
  companyId?: string | null;
}

interface WorkOrderRow {
  id: string;
  document_number: number | null;
  status: string;
  created_at: string;
  scheduled_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  planned_qty: number;
  produced_qty: number;
  notes: string | null;
  parent_work_order_id: string | null;
  bom_id: string | null;
  item: RelationMaybeArray<{ id: string; name: string; sku: string | null; uom: string | null }>;
  sector: RelationMaybeArray<{ code: string | null; name: string | null }>;
  bom: RelationMaybeArray<{ version: number | null; yield_qty: number | null; yield_uom: string | null }>;
  parent_work_order: RelationMaybeArray<{ document_number: number | null }>;
}

interface ChildOrderRow {
  parent_work_order_id: string | null;
  document_number: number | null;
  planned_qty: number;
  status: string;
  item: RelationMaybeArray<{ name: string; uom: string | null }>;
  sector: RelationMaybeArray<{ name: string | null }>;
}

interface BomLineRow {
  bom_id: string;
  component_item_id: string;
  qty: number;
  uom: string | null;
  notes: string | null;
  component: RelationMaybeArray<{ name: string; sku: string | null; uom: string | null }>;
}

interface ConsumptionRow {
  work_order_id: string;
  component_item_id: string;
  qty: number;
}

interface CompanySettingsRow {
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  website: string | null;
}

function normalizeRelation<T>(value: RelationMaybeArray<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function extractBodyHtml(html: string): string {
  const body = html.match(/<body>([\s\S]*)<\/body>/i);
  return body?.[1] || html;
}

function extractFirstStyle(html: string): string {
  const style = html.match(/<style>([\s\S]*?)<\/style>/i);
  return style?.[1] || "";
}

function buildCombinedHtml(orderHtmls: string[]): string {
  const style = orderHtmls.length > 0 ? extractFirstStyle(orderHtmls[0]) : "";
  const bodies = orderHtmls.map(extractBodyHtml);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <style>
          ${style}
          .page-break { break-before: page; page-break-before: always; display: block; height: 1px; width: 100%; }
        </style>
      </head>
      <body>
        ${bodies.join('<div class="page-break"></div>')}
      </body>
    </html>
  `;
}

function sanitizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.filter((value): value is string => typeof value === "string" && value.length > 0);
  return Array.from(new Set(ids));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PrintBatchBody>;
    const ids = sanitizeIds(body.ids);

    if (ids.length === 0) {
      return NextResponse.json({ error: "Nenhuma ordem de produção selecionada." }, { status: 400 });
    }

    if (ids.length > MAX_BATCH_IDS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_BATCH_IDS} ordens por impressão excedido.` },
        { status: 400 }
      );
    }

    const { supabase, companyId: defaultCompanyId, userId } = await resolveCompanyContext();
    const requestedCompanyId = typeof body.companyId === "string" && body.companyId.length > 0 ? body.companyId : null;
    let companyId = defaultCompanyId;

    if (requestedCompanyId && requestedCompanyId !== defaultCompanyId) {
      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("auth_user_id", userId)
        .eq("company_id", requestedCompanyId)
        .maybeSingle();

      if (membershipError) {
        throw new Error(`Falha ao validar empresa ativa: ${membershipError.message}`);
      }
      if (!membership) {
        return NextResponse.json({ error: "Empresa inválida para este usuário." }, { status: 403 });
      }
      companyId = requestedCompanyId;
    }

    const { data: workOrdersData, error: workOrdersError } = await supabase
      .from("work_orders")
      .select(`
        id,
        document_number,
        status,
        created_at,
        scheduled_date,
        started_at,
        finished_at,
        planned_qty,
        produced_qty,
        notes,
        parent_work_order_id,
        bom_id,
        item:items!work_orders_item_id_fkey(id, name, sku, uom),
        sector:production_sectors!work_orders_sector_id_fkey(code, name),
        bom:bom_headers!work_orders_bom_id_fkey(version, yield_qty, yield_uom),
        parent_work_order:work_orders!work_orders_parent_work_order_id_fkey(document_number)
      `)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("id", ids);

    if (workOrdersError) {
      throw new Error(`Falha ao carregar ordens para impressão: ${workOrdersError.message}`);
    }

    const workOrders = (workOrdersData || []) as WorkOrderRow[];
    if (workOrders.length === 0) {
      return NextResponse.json({ error: "Nenhuma ordem encontrada para impressão." }, { status: 404 });
    }

    const workOrderMap = new Map(workOrders.map((order) => [order.id, order]));
    const orderedWorkOrders = ids.map((id) => workOrderMap.get(id)).filter((order): order is WorkOrderRow => Boolean(order));
    if (orderedWorkOrders.length === 0) {
      return NextResponse.json({ error: "As ordens selecionadas não estão disponíveis." }, { status: 404 });
    }

    const bomIds = Array.from(
      new Set(
        orderedWorkOrders
          .map((order) => order.bom_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    const [{ data: settingsData, error: settingsError }, { data: childOrdersData, error: childOrdersError }, { data: bomLinesData, error: bomLinesError }, { data: consumptionsData, error: consumptionsError }] = await Promise.all([
      supabase
        .from("company_settings")
        .select("legal_name, trade_name, cnpj, address_street, address_number, address_neighborhood, address_city, address_state, website")
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("work_orders")
        .select(`
          parent_work_order_id,
          document_number,
          planned_qty,
          status,
          item:items!work_orders_item_id_fkey(name, uom),
          sector:production_sectors!work_orders_sector_id_fkey(name)
        `)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("parent_work_order_id", ids),
      bomIds.length > 0
        ? supabase
            .from("bom_lines")
            .select(`
              bom_id,
              component_item_id,
              qty,
              uom,
              notes,
              component:items!bom_lines_component_item_id_fkey(name, sku, uom)
            `)
            .eq("company_id", companyId)
            .in("bom_id", bomIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("work_order_consumptions")
        .select("work_order_id, component_item_id, qty")
        .eq("company_id", companyId)
        .in("work_order_id", ids),
    ]);

    if (settingsError) {
      throw new Error(`Falha ao carregar dados da empresa: ${settingsError.message}`);
    }
    if (childOrdersError) {
      throw new Error(`Falha ao carregar OPs vinculadas: ${childOrdersError.message}`);
    }
    if (bomLinesError) {
      throw new Error(`Falha ao carregar insumos da ficha técnica: ${bomLinesError.message}`);
    }
    if (consumptionsError) {
      throw new Error(`Falha ao carregar consumo real das OPs: ${consumptionsError.message}`);
    }

    const settings = (settingsData || null) as CompanySettingsRow | null;
    const logoDataUri = await resolveCompanyLogoDataUri(supabase, companyId) || await resolveCompanyLogoUrl(supabase, companyId) || null;

    const bomLinesByBomId = new Map<string, BomLineRow[]>();
    for (const line of ((bomLinesData || []) as BomLineRow[])) {
      const current = bomLinesByBomId.get(line.bom_id) || [];
      current.push(line);
      bomLinesByBomId.set(line.bom_id, current);
    }

    const childrenByParentId = new Map<string, ChildOrderRow[]>();
    for (const row of ((childOrdersData || []) as ChildOrderRow[])) {
      if (!row.parent_work_order_id) continue;
      const current = childrenByParentId.get(row.parent_work_order_id) || [];
      current.push(row);
      childrenByParentId.set(row.parent_work_order_id, current);
    }

    const consumedByOrderAndComponent = new Map<string, number>();
    for (const row of ((consumptionsData || []) as ConsumptionRow[])) {
      const key = `${row.work_order_id}:${row.component_item_id}`;
      const current = consumedByOrderAndComponent.get(key) || 0;
      consumedByOrderAndComponent.set(key, current + Number(row.qty || 0));
    }

    const orderHtmls = orderedWorkOrders.map((order) => {
      const item = normalizeRelation(order.item);
      const sector = normalizeRelation(order.sector);
      const bom = normalizeRelation(order.bom);
      const parentWorkOrder = normalizeRelation(order.parent_work_order);

      const bomYield = Number(bom?.yield_qty || 0);
      const factor = bomYield > 0 ? Number(order.planned_qty || 0) / bomYield : 1;
      const lines = order.bom_id ? (bomLinesByBomId.get(order.bom_id) || []) : [];

      const ingredients = lines.map((line) => {
        const component = normalizeRelation(line.component);
        const componentName = component?.name || "Insumo";
        const componentCode = component?.sku || null;
        const plannedQty = Number(line.qty || 0) * factor;
        const consumedQty = consumedByOrderAndComponent.get(`${order.id}:${line.component_item_id}`) ?? null;

        return {
          code: componentCode,
          name: componentName,
          planned_qty: Number.isFinite(plannedQty) ? plannedQty : 0,
          consumed_qty: consumedQty,
          uom: line.uom || component?.uom || item?.uom || "UN",
          notes: line.notes || null,
          lot: null,
          expiry_date: null,
        };
      });

      const childOrders = (childrenByParentId.get(order.id) || []).map((child) => {
        const childItem = normalizeRelation(child.item);
        const childSector = normalizeRelation(child.sector);
        return {
          document_number: child.document_number,
          item_name: childItem?.name || "Item",
          planned_qty: Number(child.planned_qty || 0),
          uom: childItem?.uom || "UN",
          sector_name: childSector?.name || null,
          status: child.status || null,
        };
      });

      return renderWorkOrderA4Html({
        company: {
          trade_name: settings?.trade_name || null,
          legal_name: settings?.legal_name || null,
          address_street: settings?.address_street || null,
          address_number: settings?.address_number || null,
          address_neighborhood: settings?.address_neighborhood || null,
          address_city: settings?.address_city || null,
          address_state: settings?.address_state || null,
          website: settings?.website || null,
          logo_url: logoDataUri,
        },
        workOrder: {
          id: order.id,
          document_number: order.document_number,
          status: order.status || null,
          created_at: order.created_at,
          scheduled_date: order.scheduled_date,
          started_at: order.started_at,
          finished_at: order.finished_at,
          planned_qty: Number(order.planned_qty || 0),
          produced_qty: Number(order.produced_qty || 0),
          notes: order.notes || null,
          item: {
            name: item?.name || "Produto",
            sku: item?.sku || null,
            uom: item?.uom || "UN",
          },
          sector: {
            code: sector?.code || null,
            name: sector?.name || null,
          },
          bom: {
            version: bom?.version ?? null,
            yield_qty: bom?.yield_qty ?? null,
            yield_uom: bom?.yield_uom ?? null,
          },
          parent_work_order: {
            document_number: parentWorkOrder?.document_number ?? null,
          },
        },
        ingredients,
        childOrders,
      });
    });

    const combinedHtml = buildCombinedHtml(orderHtmls);
    const pdfBuffer = await generatePdfFromHtml(combinedHtml);
    const fileName = `ops_setor_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF das ordens de produção.";
    logger.error("[work-orders/print-batch] Error", { message });

    if (message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

