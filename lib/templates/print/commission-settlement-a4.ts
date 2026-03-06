import { format } from "date-fns";

export interface CommissionSettlementPrintCompany {
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

export interface CommissionSettlementPrintOrderRow {
  order_number: number | null;
  customer_name: string;
  logistic_status: string | null;
  financial_status: string | null;
  order_total_amount: number;
  commission_rate: number;
  commission_amount: number;
}

export interface CommissionSettlementPrintHeader {
  settlement_id: string;
  settlement_number: number | null;
  representative_name: string;
  representative_document?: string | null;
  representative_address?: string | null;
  cutoff_date: string | null;
  generated_at: string | null;
  payment_due_date: string | null;
  payment_status: string | null;
  total_paid: number;
  total_orders_amount: number;
  total_commission_amount: number;
  status: string;
}

export interface CommissionSettlementA4TemplateData {
  company: CommissionSettlementPrintCompany;
  settlement: CommissionSettlementPrintHeader;
  orders: CommissionSettlementPrintOrderRow[];
}

const logisticsLabel: Record<string, string> = {
  pending: "Pendente",
  routed: "Roteirizado",
  scheduled: "Agendado",
  expedition: "Expedição",
  in_route: "Em rota",
  delivered: "Entregue",
  partial: "Parcial",
  not_delivered: "Não entregue",
  returned: "Devolvido",
  cancelled: "Cancelado",
  sandbox: "Sandbox",
};

const financialLabel: Record<string, string> = {
  pending: "Pendente",
  pre_posted: "Pré-lançado",
  pending_approval: "Pré-lançado",
  pendente_de_aprovacao: "Pré-lançado",
  approved: "Aprovado",
  in_review: "Em revisão",
  cancelled: "Cancelado",
  paid: "Pago",
  overdue: "Vencido",
  partial: "Parcial",
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

function safeNumber(value: number, decimals = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }

  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateSafe(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return format(date, "dd/MM/yyyy");
}

function formatDateTimeSafe(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return format(date, "dd/MM/yyyy HH:mm");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function translateLogisticStatus(value: string | null): string {
  if (!value) {
    return "-";
  }

  return logisticsLabel[value] ?? value;
}

function translateFinancialStatus(value: string | null): string {
  if (!value) {
    return "-";
  }

  return financialLabel[value] ?? value;
}

function isPaidPaymentStatus(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "paid" || normalized === "pago";
}

export function renderCommissionSettlementA4Html({
  company,
  settlement,
  orders,
}: CommissionSettlementA4TemplateData): string {
  const companyLegalName = safeText(company.legal_name || company.trade_name || "EMPRESA");
  const companyStreetLine = safeText(
    [company.address_street, company.address_number].filter(Boolean).join(", "),
    "-"
  );
  const companyNeighborhoodCityUfLine = safeText(
    [company.address_neighborhood, company.address_city, company.address_state].filter(Boolean).join(" - "),
    "-"
  );
  const companyWebsiteLine = safeText(company.website, "-");

  const settlementNumber = settlement.settlement_number
    ? String(settlement.settlement_number).padStart(4, "0")
    : settlement.settlement_id.slice(0, 8).toUpperCase();
  const paidAmount = isPaidPaymentStatus(settlement.payment_status) ? settlement.total_paid : 0;

  const tableRows = orders.length > 0
    ? orders
        .map(
          (order, index) => `
            <tr>
              <td class="text-center col-index">${index + 1}</td>
              <td class="col-order">#${order.order_number ? String(order.order_number).padStart(4, "0") : "----"}</td>
              <td class="col-customer">${safeText(order.customer_name)}</td>
              <td class="col-logistics">${safeText(translateLogisticStatus(order.logistic_status))}</td>
              <td class="col-financial">${safeText(translateFinancialStatus(order.financial_status))}</td>
              <td class="text-right col-order-total">${formatCurrency(order.order_total_amount)}</td>
              <td class="text-right col-rate">${safeNumber(order.commission_rate, 2)}%</td>
              <td class="text-right col-commission">${formatCurrency(order.commission_amount)}</td>
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td colspan="8" class="text-center muted">Nenhum pedido vinculado ao acerto.</td>
      </tr>
    `;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Acerto de Comissão #${settlementNumber}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { height: 100%; }
    body { font-family: Arial, "Liberation Sans", sans-serif; font-size: 10px; color: #333; line-height: 1.2; }
    .box { border: 1px solid #ccc; margin-bottom: 8px; padding: 7px; border-radius: 4px; background: #fff; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; }
    .col-2 { flex: 2; }
    .col-3 { flex: 3; }
    .header-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 2px; text-transform: uppercase; color: #111; }
    .label { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 1px; }
    .value { font-size: 10px; font-weight: normal; color: #000; margin: 0; }
    .value.bold { font-weight: bold; }
    .value.lg { font-size: 12px; }
    .value.xl { font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 2px; font-size: 9px; table-layout: fixed; }
    th { border-bottom: 2px solid #ddd; border-top: 1px solid #ddd; background: #f9f9f9; padding: 5px 6px; text-align: center; font-weight: bold; text-transform: uppercase; color: #444; }
    th.text-right, th.text-center { text-align: center; }
    td { border-bottom: 1px solid #eee; padding: 5px 6px; text-align: left; vertical-align: top; color: #000; }
    tbody tr:nth-child(even) { background-color: #fbfbfb; }
    .col-index { width: 3%; white-space: nowrap; }
    .col-order { width: 9%; white-space: nowrap; }
    .col-customer { width: 33%; white-space: normal; word-break: normal; overflow-wrap: break-word; }
    .col-logistics { width: 9%; white-space: nowrap; }
    .col-financial { width: 13%; white-space: nowrap; }
    .col-order-total { width: 15%; white-space: nowrap; }
    .col-rate { width: 7%; white-space: nowrap; }
    .col-commission { width: 11%; white-space: nowrap; }
    td.col-order, td.col-logistics, td.col-financial, td.col-rate { text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .muted { font-style: italic; }
    .totals-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .total-tile { border: 1px solid #ddd; border-radius: 4px; padding: 6px; background: #fff; }
  </style>
</head>
<body>
  <div class="box">
    <div class="row" style="align-items: center;">
      <div class="col text-center">
         ${company.logo_url ? `<img src="${company.logo_url}" style="max-height: 46px; margin-bottom: 4px;" alt="Logo" />` : ``}
         <div class="value bold lg">${companyLegalName}</div>
         <div class="value">${companyStreetLine}</div>
         <div class="value">${companyNeighborhoodCityUfLine}</div>
         <div class="value">${companyWebsiteLine}</div>
      </div>
      <div class="col text-center" style="border-left: 1px solid #eee; padding-left: 10px;">
         <div class="header-title">Fechamento de Comissão</div>
         <div class="value bold xl">#${settlementNumber}</div>
         <div class="value" style="margin-top: 4px;">STATUS: <strong>${safeText(settlement.status)}</strong></div>
         <div class="value">PAGAMENTO: <strong>${safeText(translateFinancialStatus(settlement.payment_status))}</strong></div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="label" style="border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px;">DADOS DO REPRESENTANTE</div>
    <div class="row">
      <div class="col-2">
        <div class="label">Nome / Razão social</div>
        <div class="value bold lg">${safeText(settlement.representative_name)}</div>
      </div>
      <div class="col">
        <div class="label">CNPJ / CPF</div>
        <div class="value">${safeText(settlement.representative_document)}</div>
      </div>
    </div>
    <div class="row" style="margin-top: 8px;">
      <div class="col">
        <div class="label">Endereço</div>
        <div class="value">${safeText(settlement.representative_address)}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="row">
      <div class="col">
        <div class="label">Data de corte</div>
        <div class="value bold">${formatDateSafe(settlement.cutoff_date)}</div>
      </div>
      <div class="col">
        <div class="label">Data da geração</div>
        <div class="value bold">${formatDateTimeSafe(settlement.generated_at)}</div>
      </div>
      <div class="col">
        <div class="label">Data prevista de pagamento</div>
        <div class="value bold">${formatDateSafe(settlement.payment_due_date)}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="label" style="border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px;">PEDIDOS VINCULADOS AO FECHAMENTO</div>
    <table>
      <colgroup>
        <col style="width: 3%;">
        <col style="width: 9%;">
        <col style="width: 33%;">
        <col style="width: 9%;">
        <col style="width: 13%;">
        <col style="width: 15%;">
        <col style="width: 7%;">
        <col style="width: 11%;">
      </colgroup>
      <thead>
        <tr>
          <th class="text-center col-index">#</th>
          <th class="col-order">Pedido</th>
          <th class="col-customer">Cliente</th>
          <th class="col-logistics">Logístico</th>
          <th class="col-financial">Financeiro</th>
          <th class="text-right col-order-total">Valor pedido</th>
          <th class="text-right col-rate">%</th>
          <th class="text-right col-commission">Comissão</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <div class="box" style="background-color: #fbfbfb;">
    <div class="totals-grid">
      <div class="total-tile">
        <div class="label">Total pedidos</div>
        <div class="value bold lg">${formatCurrency(settlement.total_orders_amount)}</div>
      </div>
      <div class="total-tile">
        <div class="label">Total comissão</div>
        <div class="value bold lg">${formatCurrency(settlement.total_commission_amount)}</div>
      </div>
      <div class="total-tile">
        <div class="label">Total pago</div>
        <div class="value bold lg">${formatCurrency(paidAmount)}</div>
      </div>
    </div>
  </div>
</body>
</html>
`;
}
