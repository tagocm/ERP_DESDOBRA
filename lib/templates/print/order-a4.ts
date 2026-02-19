
import { format } from "date-fns";
import { translateLogisticsStatusPt } from "@/lib/constants/status";

interface TemplateData {
  company: any;
  order: any;
  items: any[];
}

export function renderOrderA4Html({ company, order, items }: TemplateData): string {
  const formatDate = (date: string) => date ? format(new Date(date), "dd/MM/yyyy") : "-";
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  const isDeliveredStatus = (status?: string | null): boolean => {
    const s = String(status || '').toLowerCase();
    return ['delivered', 'delivered_partial', 'returned_partial', 'returned_total', 'entregue', 'parcial', 'total'].includes(s);
  };
  const sealFromDeliveryStatus = (status?: string | null): 'P' | 'T' | null => {
    const s = String(status || '').toLowerCase();
    if (!s) return null;
    if (['delivered_partial', 'returned_partial', 'partial', 'parcial'].includes(s)) return 'P';
    if (['delivered', 'returned_total', 'entregue', 'total'].includes(s)) return 'T';
    return null;
  };

  // Calcula totais se não vierem prontos
  const totalItems = items.reduce((acc, item) => acc + (item.total_amount || 0), 0);
  const totalDiscount = order.discount_amount || 0;
  const totalFreight = Number(order.freight_amount || 0);
  const totalOrder = Number(order.total_amount ?? (totalItems - totalDiscount + totalFreight));

  // Fallback seguro para dados
  const clientName = (order.client?.trade_name || order.client?.legal_name || "Consumidor Final").toUpperCase();
  const clientDoc = order.client?.document || order.client?.document_number || "---";

  // Prefer resolved address from backend (route.ts), fallback to fields
  const clientAddress = order.client_address_resolved || order.client_address || order.delivery_address || "Endereço não informado";

  const companyLegalName = (company?.legal_name || company?.trade_name || "EMPRESA").toUpperCase();
  const companyStreetLine = [company?.address_street, company?.address_number].filter(Boolean).join(', ') || company?.address || "-";
  const companyNeighborhoodCityUfLine = [company?.address_neighborhood, company?.address_city, company?.address_state].filter(Boolean).join(' - ') || "-";
  const companyWebsiteLine = company?.website || "-";
  const isPartialOrder = order?.is_partial_order === true || order?.loading_status === 'partial' || order?.status_logistic === 'partial';
  const financialEntries: any[] = Array.isArray(order?.financial_entries) ? order.financial_entries : [];
  const rawDeliveryEvents = Array.isArray(order?.delivery_events)
    ? order.delivery_events
    : (Array.isArray(order?.deliveries) ? order.deliveries : []);

  const deliveryEvents: Array<{ date: string; seal: 'P' | 'T' }> = rawDeliveryEvents
    .map((ev: any) => {
      const status = ev?.status;
      // Only include truly delivered events. If status is absent, fallback to explicit seal only.
      if (status && !isDeliveredStatus(status)) return null;
      const seal = (ev?.seal === 'P' || ev?.seal === 'T')
        ? ev.seal
        : sealFromDeliveryStatus(status);
      if (!seal) return null;
      return { date: formatDate(ev?.date || ev?.updated_at || ev?.created_at), seal };
    })
    .filter(Boolean) as Array<{ date: string; seal: 'P' | 'T' }>;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido ${order.document_number}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { height: 100%; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10px; color: #333; line-height: 1.2; display: flex; flex-direction: column; min-height: 100%; }
    .page-break { break-before: page; page-break-before: always; }
    
    .box { border: 1px solid #ccc; margin-bottom: 8px; padding: 7px; border-radius: 4px; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; }
    .col-2 { flex: 2; }
    .col-3 { flex: 3; }
    
    .header-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 2px; text-transform: uppercase; color: #111; }
    .label { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 1px; }
    .value { font-size: 10px; font-weight: normal; color: #000; margin: 0; }
    .value.bold { font-weight: bold; }
    .value.lg { font-size: 12px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 2px; font-size: 9px; }
    th { border-bottom: 2px solid #ddd; background: #f9f9f9; padding: 4px; text-align: left; font-weight: bold; text-transform: uppercase; color: #444; }
    td { border-bottom: 1px solid #eee; padding: 4px; text-align: left; vertical-align: top; }
    tr:nth-child(even) { background-color: #fbfbfb; }
    
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-red { color: #555; }
    
    .footer-note { font-size: 8px; text-align: center; margin-top: 8px; border-top: 1px solid #eee; padding-top: 5px; color: #888; }
    .main-content { flex: 1 1 auto; display: flex; flex-direction: column; }
    .items-box { flex: 1 1 auto; display: flex; flex-direction: column; }
    .items-table-wrap { flex: 1 1 auto; }
    .invoice-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
    .invoice-tile {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 3px 2px;
      background: #fafafa;
      min-height: 42px;
      width: 65%;
      justify-self: center;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }
    .invoice-line-1 { font-size: 9px; font-weight: 700; color: #111827; line-height: 1.05; margin: 0; }
    .invoice-line-2 { font-size: 9px; font-weight: 600; color: #374151; line-height: 1.05; margin: 0; }
    .invoice-line-3 { font-size: 9px; font-weight: 700; color: #111827; line-height: 1.05; margin: 0; }
    .invoice-line-4 { font-size: 9px; font-weight: 600; color: #333; line-height: 1.05; margin: 0; text-transform: lowercase; }
    .delivery-box { margin-top: 6px; border-top: 1px solid #e5e7eb; padding-top: 5px; height: 32px; overflow: hidden; }
    .delivery-list { display: flex; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; }
    .delivery-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; color: #111; }
    .delivery-seal { display: inline-flex; align-items: center; justify-content: center; min-width: 14px; height: 14px; border: 1px solid #555; border-radius: 999px; font-size: 8px; font-weight: 700; color: #111; background: #fff; }
  </style>
</head>
<body>
  <div class="main-content">

  <!-- Cabeçalho Principal -->
  <div class="box">
    <div class="row" style="align-items: center;">
      <div class="col text-center">
         ${company?.logo_url ? `<img src="${company.logo_url}" style="max-height: 46px; margin-bottom: 4px;" alt="Logo" />` : ``}
         <div class="value bold lg" style="margin-top: 1px;">${companyLegalName}</div>
         <div class="value">${companyStreetLine}</div>
         <div class="value">${companyNeighborhoodCityUfLine}</div>
         <div class="value">${companyWebsiteLine}</div>
      </div>
      <div class="col text-center" style="border-left: 1px solid #eee; padding-left: 10px;">
         <div class="header-title">PEDIDO DE VENDA</div>
         <div class="value bold" style="font-size: 20px; color: #444;">Nº ${String(order.document_number).padStart(6, '0')}</div>
         <div class="value" style="margin-top: 4px;">EMISSÃO: <strong>${formatDate(order.date_issued)}</strong></div>
         <div class="value">STATUS: <strong style="text-transform: uppercase;">${order.status_commercial || order.status || "Novo"}</strong></div>
         <div class="delivery-box">
           <div class="label">ENTREGAS EFETUADAS ANTERIORES</div>
           ${deliveryEvents.length > 0
             ? `<div class="delivery-list">${deliveryEvents.slice(0, 6).map((ev) => `
                 <span class="delivery-chip">
                   <span>${ev.date}</span>
                   <span class="delivery-seal">${ev.seal}</span>
                 </span>
               `).join('')}</div>`
             : `<div class="value">Sem entregas efetuadas.</div>`
           }
         </div>
      </div>
    </div>
  </div>

  <!-- Dados do Cliente -->
  <div class="box">
    <div class="label" style="border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px;">DADOS DO CLIENTE</div>
    <div class="row">
      <div class="col-3">
        <div class="label">NOME / RAZÃO SOCIAL</div>
        <div class="value bold lg">${clientName}</div>
      </div>
      <div class="col">
        <div class="label">CNPJ / CPF</div>
        <div class="value">${clientDoc}</div>
      </div>
    </div>
    <div class="row mt-2" style="margin-top: 10px;">
      <div class="col">
        <div class="label">ENDEREÇO DE ENTREGA</div>
        <div class="value">${clientAddress}</div>
      </div>
    </div>
  </div>

  <!-- Fatura -->
  <div class="box">
    <div class="label" style="border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px;">FATURA</div>
    ${isPartialOrder
      ? `<div class="value bold">Pedido parcial.</div>`
      : financialEntries.length > 0
        ? `
        <div class="invoice-grid">
          ${financialEntries.map((entry: any) => `
            <div class="invoice-tile">
              <div class="invoice-line-1">Parcela ${entry.installment_number ?? '-'}</div>
              <div class="invoice-line-2">${formatDate(entry.due_date)}</div>
              <div class="invoice-line-3">${formatCurrency(Number(entry.amount_original || 0))}</div>
              <div class="invoice-line-4">${entry.payment_method || '-'}</div>
            </div>
          `).join('')}
        </div>
        `
        : `<div class="value">Sem lançamentos financeiros vinculados ao pedido.</div>`
    }
  </div>

  <!-- Itens -->
  <div class="box items-box" style="min-height: 220px; border: none; padding: 0;">
    <div class="label" style="margin-bottom: 4px;">ITENS DO PEDIDO</div>
    <div class="items-table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th style="width: 80px;">CÓDIGO</th>
          <th>DESCRIÇÃO</th>
          <th style="width: 40px; text-align: center;">UN</th>
          <th class="text-right" style="width: 60px;">QTD</th>
          <th class="text-right" style="width: 90px;">VLR UNIT</th>
          <th class="text-right" style="width: 90px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
        <tr>
          <td class="text-center" style="color: #888;">${idx + 1}</td>
          <td>${item.product?.sku || item.item_id?.slice(0, 6) || ""}</td>
          <td>
            <div style="font-weight: 500;">${item.product?.name || "Produto sem nome"}</div>
            ${item.notes ? `<div style="font-size:9px; color:#666; margin-top:3px; font-style: italic;">${item.notes}</div>` : ""}
            ${item.packaging?.label ? `<div style="font-size:9px; color:#555; margin-top:2px;">Embalagem: ${item.packaging.label}</div>` : ""}
          </td>
          <td class="text-center">${item.product?.un || "UN"}</td>
          <td class="text-right font-bold">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unit_price)}</td>
          <td class="text-right bold">${formatCurrency(item.total_amount)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  </div>
  </div>

  <!-- Totais -->
  <div class="box" style="background-color: #fbfbfb; margin-top: auto;">
    <div class="row">
      <div class="col-2">
         <div class="label">OBSERVAÇÕES INTERNAS / ENTREGA</div>
         <div class="value" style="font-style: italic; white-space: pre-wrap;">${order.internal_notes || order.notes || "Sem observações."}</div>
      </div>
      <div class="col">
        <table style="margin: 0; border: none;">
           <tr>
             <td style="border:none; padding: 4px;" class="text-right label">TOTAL ITENS:</td>
             <td style="border:none; padding: 4px;" class="text-right value">${formatCurrency(totalItems)}</td>
           </tr>
           <tr>
             <td style="border:none; padding: 4px;" class="text-right label">DESCONTOS:</td>
             <td style="border:none; padding: 4px;" class="text-right value text-red">-${formatCurrency(totalDiscount)}</td>
           </tr>
           <tr>
             <td style="border:none; padding: 4px;" class="text-right label">FRETE:</td>
             <td style="border:none; padding: 4px;" class="text-right value">${formatCurrency(totalFreight)}</td>
           </tr>
           <tr>
             <td style="border:none; padding: 8px; border-top: 2px solid #ddd;" class="text-right label" style="font-size: 12px;">TOTAL PEDIDO:</td>
             <td style="border:none; padding: 8px; border-top: 2px solid #ddd;" class="text-right value bold lg" style="font-size: 16px;">${formatCurrency(totalOrder)}</td>
           </tr>
        </table>
      </div>
    </div>
  </div>

  <!-- Rodapé Logística (Se houver) -->
  <div class="box">
    <div class="row">
       <div class="col">
         <div class="label">FRETE POR CONTA</div>
         <div class="value">${order.freight_responsibility || (order.freight_mode === '0' || order.freight_mode === 'CIF' ? "EMITENTE (CIF)" : "DESTINATÁRIO (FOB)")}</div>
       </div>
       <div class="col">
         <div class="label">TRANSPORTADORA</div>
         <div class="value">${order.shipping_company_name || order.carrier?.trade_name || "---"}</div>
       </div>
       <div class="col">
         <div class="label">STATUS LOGÍSTICO</div>
         <div class="value">${(translateLogisticsStatusPt(order.status_logistic) || "Pendente").toUpperCase()}</div>
       </div>
    </div>
  </div>

  <div class="footer-note">
    Documento auxiliar de pedido. Não possui valor fiscal. Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}.
  </div>

</body>
</html>
  `;
}
