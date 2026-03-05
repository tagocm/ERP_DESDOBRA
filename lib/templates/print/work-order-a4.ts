import { format } from "date-fns";

export interface WorkOrderPrintCompany {
  trade_name?: string | null;
  legal_name?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

export interface WorkOrderPrintItem {
  name: string;
  sku?: string | null;
  uom?: string | null;
}

export interface WorkOrderPrintSector {
  code?: string | null;
  name?: string | null;
}

export interface WorkOrderPrintBom {
  version?: number | null;
  yield_qty?: number | null;
  yield_uom?: string | null;
}

export interface WorkOrderPrintReference {
  document_number?: number | null;
}

export interface WorkOrderPrintOrder {
  id: string;
  document_number?: number | null;
  status?: string | null;
  created_at?: string | null;
  scheduled_date?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  planned_qty: number;
  produced_qty?: number | null;
  notes?: string | null;
  item?: WorkOrderPrintItem | null;
  sector?: WorkOrderPrintSector | null;
  bom?: WorkOrderPrintBom | null;
  parent_work_order?: WorkOrderPrintReference | null;
}

export interface WorkOrderPrintIngredient {
  code?: string | null;
  name: string;
  planned_qty: number;
  consumed_qty?: number | null;
  uom?: string | null;
  lot?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}

export interface WorkOrderPrintChildOrder {
  document_number?: number | null;
  item_name: string;
  planned_qty: number;
  uom?: string | null;
  sector_name?: string | null;
  status?: string | null;
}

export interface WorkOrderPrintCheckpoint {
  sector: string;
  activity: string;
}

export interface WorkOrderA4TemplateData {
  company: WorkOrderPrintCompany;
  workOrder: WorkOrderPrintOrder;
  ingredients?: WorkOrderPrintIngredient[];
  childOrders?: WorkOrderPrintChildOrder[];
  checkpoints?: WorkOrderPrintCheckpoint[];
}

const DEFAULT_CHECKPOINTS: WorkOrderPrintCheckpoint[] = [
  { sector: "Almoxarifado", activity: "Separação de insumos e conferência de lotes" },
  { sector: "Produção", activity: "Execução da ordem / mistura / processamento" },
  { sector: "Envase", activity: "Envase, pesagem e identificação" },
  { sector: "Qualidade", activity: "Liberação de processo e produto" },
];

const STATUS_LABELS: Record<string, string> = {
  planned: "Planejada",
  in_progress: "Em produção",
  done: "Concluída",
  cancelled: "Cancelada",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeText(value?: string | null, fallback = "-"): string {
  const resolved = (value ?? "").toString().trim();
  return resolved.length > 0 ? escapeHtml(resolved) : fallback;
}

function safeNumber(value?: number | null, decimals = 2): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: decimals }) : "0";
}

function formatDateSafe(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy");
}

function formatDateTimeSafe(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm");
}

export function renderWorkOrderA4Html({
  company,
  workOrder,
  ingredients = [],
  childOrders = [],
  checkpoints = DEFAULT_CHECKPOINTS,
}: WorkOrderA4TemplateData): string {
  const companyName = safeText(company.trade_name || company.legal_name || "Empresa");
  const companyStreetLine = safeText(
    [company.address_street, company.address_number].filter(Boolean).join(", "),
    "-"
  );
  const companyCityLine = safeText(
    [company.address_neighborhood, company.address_city, company.address_state].filter(Boolean).join(" - "),
    "-"
  );
  const companySite = safeText(company.website, "-");

  const opNumber = workOrder.document_number
    ? String(workOrder.document_number).padStart(6, "0")
    : workOrder.id.slice(0, 8).toUpperCase();

  const itemName = safeText(workOrder.item?.name, "Produto não informado");
  const itemSku = safeText(workOrder.item?.sku, "-");
  const itemUom = safeText(workOrder.item?.uom, "UN");
  const sector = safeText(
    workOrder.sector ? `${workOrder.sector.code || "-"} - ${workOrder.sector.name || "-"}` : "-",
    "-"
  );
  const status = safeText(STATUS_LABELS[workOrder.status || ""] || workOrder.status || "Planejada");
  const bomVersion = workOrder.bom?.version ? `v${workOrder.bom.version}` : "-";
  const bomYield = workOrder.bom?.yield_qty
    ? `${safeNumber(workOrder.bom.yield_qty, 4)} ${safeText(workOrder.bom?.yield_uom || itemUom)}`
    : "-";
  const plannedQty = `${safeNumber(workOrder.planned_qty, 4)} ${itemUom}`;
  const producedQty = `${safeNumber(workOrder.produced_qty, 4)} ${itemUom}`;
  const recipeCount = workOrder.bom?.yield_qty && workOrder.bom.yield_qty > 0
    ? Math.ceil(workOrder.planned_qty / workOrder.bom.yield_qty)
    : 0;
  const parentOp = workOrder.parent_work_order?.document_number
    ? `#${String(workOrder.parent_work_order.document_number).padStart(6, "0")}`
    : "-";

  const ingredientsRows = ingredients.length > 0
    ? ingredients
        .map((ingredient, index) => `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${safeText(ingredient.code, "-")}</td>
          <td>
            <div class="name">${safeText(ingredient.name)}</div>
            ${ingredient.notes ? `<div class="note">${safeText(ingredient.notes)}</div>` : ""}
          </td>
          <td class="text-right">${safeNumber(ingredient.planned_qty, 4)}</td>
          <td class="text-right">${safeNumber(ingredient.consumed_qty, 4)}</td>
          <td class="text-center">${safeText(ingredient.uom || itemUom)}</td>
          <td>${safeText(ingredient.lot, "")}</td>
          <td class="text-center">${formatDateSafe(ingredient.expiry_date)}</td>
        </tr>
      `)
        .join("")
    : `
      <tr>
        <td colspan="8" class="text-center muted">Nenhum insumo informado para esta ordem.</td>
      </tr>
    `;

  const childOrderRows = childOrders.length > 0
    ? childOrders
        .map((child) => `
        <tr>
          <td>${child.document_number ? `#${String(child.document_number).padStart(6, "0")}` : "-"}</td>
          <td>${safeText(child.item_name)}</td>
          <td class="text-right">${safeNumber(child.planned_qty, 4)} ${safeText(child.uom || itemUom)}</td>
          <td>${safeText(child.sector_name, "-")}</td>
          <td>${safeText(STATUS_LABELS[child.status || ""] || child.status || "-")}</td>
        </tr>
      `)
        .join("")
    : `
      <tr>
        <td colspan="5" class="text-center muted">Sem OPs vinculadas.</td>
      </tr>
    `;

  const checkpointsRows = checkpoints
    .map(
      (checkpoint) => `
      <tr>
        <td>${safeText(checkpoint.sector)}</td>
        <td>${safeText(checkpoint.activity)}</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem de Produção ${opNumber}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, "Liberation Sans", sans-serif; font-size: 10px; color: #1f2937; line-height: 1.25; }
    .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
    .row { display: flex; gap: 10px; }
    .col { flex: 1; }
    .col-2 { flex: 2; }
    .title { font-size: 16px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; margin-bottom: 2px; }
    .label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 2px; }
    .value { font-size: 10px; color: #111827; }
    .value-lg { font-size: 18px; font-weight: 700; }
    .hr { height: 1px; background: #e5e7eb; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th { text-align: left; background: #f9fafb; border-bottom: 2px solid #d1d5db; padding: 4px; text-transform: uppercase; font-size: 8px; }
    td { border-bottom: 1px solid #e5e7eb; padding: 4px; vertical-align: top; }
    .name { font-weight: 600; }
    .note { color: #6b7280; font-size: 8px; margin-top: 2px; font-style: italic; }
    .muted { color: #6b7280; font-style: italic; padding: 10px 0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 6px; }
    .signature-box { border: 1px dashed #d1d5db; border-radius: 6px; min-height: 56px; padding: 6px; }
    .small { font-size: 8px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="box">
    <div class="row" style="align-items:center;">
      <div class="col-2">
        ${company.logo_url ? `<img src="${company.logo_url}" alt="Logo" style="max-height: 42px; margin-bottom: 4px;" />` : ""}
        <div class="value" style="font-weight:700;">${companyName}</div>
        <div class="small">${companyStreetLine}</div>
        <div class="small">${companyCityLine}</div>
        <div class="small">${companySite}</div>
      </div>
      <div class="col text-center" style="border-left:1px solid #e5e7eb; padding-left:10px;">
        <div class="title">Ordem de Produção</div>
        <div class="value-lg">#${opNumber}</div>
        <div class="small">Emissão: ${formatDateTimeSafe(workOrder.created_at)}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="label">Resumo da ordem</div>
    <div class="row">
      <div class="col-2">
        <div class="label">Produto</div>
        <div class="value">${itemName}</div>
        <div class="small">SKU: ${itemSku}</div>
      </div>
      <div class="col">
        <div class="label">Setor</div>
        <div class="value">${sector}</div>
      </div>
      <div class="col">
        <div class="label">Status</div>
        <div class="value">${status}</div>
      </div>
    </div>
    <div class="hr"></div>
    <div class="row">
      <div class="col">
        <div class="label">Data programada</div>
        <div class="value">${formatDateSafe(workOrder.scheduled_date)}</div>
      </div>
      <div class="col">
        <div class="label">Início real</div>
        <div class="value">${formatDateTimeSafe(workOrder.started_at)}</div>
      </div>
      <div class="col">
        <div class="label">Fim real</div>
        <div class="value">${formatDateTimeSafe(workOrder.finished_at)}</div>
      </div>
      <div class="col">
        <div class="label">OP mãe</div>
        <div class="value">${parentOp}</div>
      </div>
    </div>
    <div class="hr"></div>
    <div class="row">
      <div class="col">
        <div class="label">FT / Receita</div>
        <div class="value">${bomVersion}</div>
      </div>
      <div class="col">
        <div class="label">Rendimento FT</div>
        <div class="value">${bomYield}</div>
      </div>
      <div class="col">
        <div class="label">Qtd. planejada</div>
        <div class="value">${plannedQty}</div>
      </div>
      <div class="col">
        <div class="label">Qtd. produzida</div>
        <div class="value">${producedQty}</div>
      </div>
      <div class="col">
        <div class="label">Receitas estimadas</div>
        <div class="value">${recipeCount}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="label">Instruções da OP</div>
    <div class="value">${safeText(workOrder.notes, "Sem observações para esta OP.")}</div>
  </div>

  <div class="box">
    <div class="label">Insumos (Previsto x Real)</div>
    <table>
      <thead>
        <tr>
          <th style="width:24px;" class="text-center">#</th>
          <th style="width:70px;">Código</th>
          <th>Insumo</th>
          <th style="width:72px;" class="text-right">Previsto</th>
          <th style="width:72px;" class="text-right">Consumido</th>
          <th style="width:40px;" class="text-center">UN</th>
          <th style="width:90px;">Lote</th>
          <th style="width:64px;" class="text-center">Val.</th>
        </tr>
      </thead>
      <tbody>
        ${ingredientsRows}
      </tbody>
    </table>
  </div>

  <div class="box">
    <div class="label">Acompanhamento por setor</div>
    <table>
      <thead>
        <tr>
          <th style="width:90px;">Setor</th>
          <th>Atividade</th>
          <th style="width:90px;">Responsável</th>
          <th style="width:78px;">Hora início/fim</th>
          <th style="width:90px;">Assinatura</th>
        </tr>
      </thead>
      <tbody>
        ${checkpointsRows}
      </tbody>
    </table>
  </div>

  <div class="box">
    <div class="label">OPs vinculadas (dependências)</div>
    <table>
      <thead>
        <tr>
          <th style="width:70px;">OP</th>
          <th>Item</th>
          <th style="width:120px;" class="text-right">Qtd planejada</th>
          <th style="width:120px;">Setor</th>
          <th style="width:90px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${childOrderRows}
      </tbody>
    </table>
  </div>

  <div class="box">
    <div class="label">Confirmações</div>
    <div class="signature-grid">
      <div class="signature-box">
        <div class="small">Produção</div>
      </div>
      <div class="signature-box">
        <div class="small">Qualidade</div>
      </div>
      <div class="signature-box">
        <div class="small">PCP / Supervisão</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
