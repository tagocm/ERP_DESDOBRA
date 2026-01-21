
import { format } from "date-fns";

interface TemplateData {
  company: any;
  order: any;
  items: any[];
}

export function renderOrderA4Html({ company, order, items }: TemplateData): string {
  const formatDate = (date: string) => date ? format(new Date(date), "dd/MM/yyyy") : "-";
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  // Calcula totais se não vierem prontos
  const totalItems = items.reduce((acc, item) => acc + (item.total_amount || 0), 0);
  const totalDiscount = order.discount_amount || 0;
  const totalOrder = order.total_amount || (totalItems - totalDiscount);

  // Fallback seguro para dados
  const clientName = (order.client?.trade_name || order.client?.legal_name || "Consumidor Final").toUpperCase();
  const clientDoc = order.client?.document || order.client?.document_number || "---";

  // Prefer resolved address from backend (route.ts), fallback to fields
  const clientAddress = order.client_address_resolved || order.client_address || order.delivery_address || "Endereço não informado";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido ${order.document_number}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.3; }
    .page-break { break-before: page; page-break-before: always; }
    
    .box { border: 1px solid #ccc; margin-bottom: 12px; padding: 10px; border-radius: 4px; }
    .row { display: flex; gap: 20px; }
    .col { flex: 1; }
    .col-2 { flex: 2; }
    .col-3 { flex: 3; }
    
    .header-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 4px; text-transform: uppercase; color: #111; }
    .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 2px; }
    .value { font-size: 11px; font-weight: normal; color: #000; }
    .value.bold { font-weight: bold; }
    .value.lg { font-size: 13px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 10px; }
    th { border-bottom: 2px solid #ddd; background: #f9f9f9; padding: 6px; text-align: left; font-weight: bold; text-transform: uppercase; color: #444; }
    td { border-bottom: 1px solid #eee; padding: 6px; text-align: left; vertical-align: top; }
    tr:nth-child(even) { background-color: #fbfbfb; }
    
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-red { color: #d00; }
    
    .footer-note { font-size: 9px; text-align: center; margin-top: 15px; border-top: 1px solid #eee; padding-top: 8px; color: #888; }
  </style>
</head>
<body>

  <!-- Cabeçalho Principal -->
  <div class="box">
    <div class="row" style="align-items: center;">
      <div class="col text-center">
         ${company?.logo_url ? `<img src="${company.logo_url}" style="max-height: 70px; margin-bottom: 8px;" alt="Logo" />` : ``}
         <div class="value bold lg" style="margin-top: 4px;">${company?.trade_name || "EMPRESA MODELO"}</div>
         <div class="value">${company?.legal_name || ""}</div>
         <div class="value">CNPJ: ${company?.document || ""}</div>
         <div class="value" style="font-size: 10px; color: #555;">${company?.address || ""}</div>
      </div>
      <div class="col text-center" style="border-left: 1px solid #eee; padding-left: 15px;">
         <div class="header-title">PEDIDO DE VENDA</div>
         <div class="value bold" style="font-size: 24px; color: #444;">Nº ${String(order.document_number).padStart(6, '0')}</div>
         <div class="value" style="margin-top: 8px;">EMISSÃO: <strong>${formatDate(order.date_issued)}</strong></div>
         <div class="value">STATUS: <strong style="text-transform: uppercase;">${order.status_commercial || order.status || "Novo"}</strong></div>
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

  <!-- Itens -->
  <div class="box" style="min-height: 300px; border: none; padding: 0;">
    <div class="label" style="margin-bottom: 8px;">ITENS DO PEDIDO</div>
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
            ${item.packaging?.label ? `<div style="font-size:9px; color:#0e7490; margin-top:2px;">Embalagem: ${item.packaging.label}</div>` : ""}
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

  <!-- Totais -->
  <div class="box" style="background-color: #fbfbfb;">
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
           ${totalDiscount > 0 ? `
           <tr>
             <td style="border:none; padding: 4px;" class="text-right label">DESCONTOS:</td>
             <td style="border:none; padding: 4px;" class="text-right value text-red">-${formatCurrency(totalDiscount)}</td>
           </tr>` : ''}
           <tr>
             <td style="border:none; padding: 4px;" class="text-right label">FRETE:</td>
             <td style="border:none; padding: 4px;" class="text-right value">${formatCurrency(order.freight_amount || 0)}</td>
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
         <div class="value">${order.status_logistic || "PENDENTE"}</div>
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
