
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
    const clientName = order.client?.trade_name || order.client?.legal_name || "Consumidor Final";
    const clientDoc = order.client?.document || "---";
    const clientAddress = order.client_address || order.delivery_address || "";

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido ${order.document_number}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10px; color: #333; line-height: 1.3; }
    .page-break { break-before: page; page-break-before: always; }
    
    .box { border: 1px solid #000; margin-bottom: 8px; padding: 5px; border-radius: 2px; }
    .row { display: flex; gap: 10px; }
    .col { flex: 1; }
    .col-2 { flex: 2; }
    .col-3 { flex: 3; }
    
    .header-title { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
    .label { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #555; }
    .value { font-size: 10px; font-weight: normal; }
    .value.bold { font-weight: bold; }
    .value.lg { font-size: 12px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 9px; }
    th { border: 1px solid #000; background: #eee; padding: 4px; text-align: left; font-weight: bold; text-transform: uppercase; }
    td { border: 1px solid #000; padding: 4px; text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    
    .footer-note { font-size: 8px; text-align: center; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 5px; }

    /* Utilitários */
    .mt-2 { margin-top: 8px; }
    .mb-0 { margin-bottom: 0; }
  </style>
</head>
<body>

  <!-- Cabeçalho Principal -->
  <div class="box">
    <div class="row">
      <div class="col text-center">
         <div class="label">EMITENTE</div>
         <div class="value bold lg">${company?.trade_name || "EMPRESA MODELO"}</div>
         <div class="value">${company?.legal_name || ""}</div>
         <div class="value">CNPJ: ${company?.document || ""}</div>
         <div class="value">${company?.address || ""}</div>
      </div>
      <div class="col text-center" style="border-left: 1px solid #000; display: flex; flex-direction: column; justify-content: center;">
         <div class="header-title">PEDIDO DE VENDA</div>
         <div class="value bold lg">Nº ${String(order.document_number).padStart(6, '0')}</div>
         <div class="value">EMISSÃO: ${formatDate(order.date_issued)}</div>
      </div>
    </div>
  </div>

  <!-- Dados do Cliente -->
  <div class="box">
    <div class="label" style="border-bottom: 1px solid #eee; margin-bottom: 4px;">DESTINATÁRIO / CLIENTE</div>
    <div class="row">
      <div class="col-3">
        <div class="label">NOME / RAZÃO SOCIAL</div>
        <div class="value bold">${clientName}</div>
      </div>
      <div class="col">
        <div class="label">CNPJ / CPF</div>
        <div class="value">${clientDoc}</div>
      </div>
    </div>
    <div class="row mt-2">
      <div class="col">
        <div class="label">ENDEREÇO</div>
        <div class="value">${clientAddress}</div>
      </div>
    </div>
  </div>

  <!-- Itens -->
  <div class="box" style="min-height: 400px; border: none; padding: 0;">
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>CÓDIGO</th>
          <th>DESCRIÇÃO</th>
          <th style="width: 30px;">UN</th>
          <th class="text-right" style="width: 50px;">QTD</th>
          <th class="text-right" style="width: 70px;">VLR UNIT</th>
          <th class="text-right" style="width: 70px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${item.product?.sku || item.item_id?.slice(0, 6) || ""}</td>
          <td>
            ${item.product?.name || "Produto sem nome"}
            ${item.notes ? `<div style="font-size:8px; color:#666; margin-top:2px;">OBS: ${item.notes}</div>` : ""}
          </td>
          <td class="text-center">${item.product?.un || "UN"}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unit_price)}</td>
          <td class="text-right">${formatCurrency(item.total_amount)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Totais -->
  <div class="box">
    <div class="row">
      <div class="col-2">
         <div class="label">OBSERVAÇÕES</div>
         <div class="value" style="font-style: italic;">${order.internal_notes || order.notes || "Sem observações."}</div>
      </div>
      <div class="col">
        <table style="margin: 0; border: none;">
           <tr>
             <td style="border:none; padding: 2px;" class="text-right label">TOTAL ITENS:</td>
             <td style="border:none; padding: 2px;" class="text-right value">${formatCurrency(totalItems)}</td>
           </tr>
           <tr>
             <td style="border:none; padding: 2px;" class="text-right label">DESCONTOS:</td>
             <td style="border:none; padding: 2px;" class="text-right value text-red">-${formatCurrency(totalDiscount)}</td>
           </tr>
           <tr>
             <td style="border:none; padding: 2px; border-top: 1px solid #000;" class="text-right label">TOTAL PEDIDO:</td>
             <td style="border:none; padding: 2px; border-top: 1px solid #000;" class="text-right value bold lg">${formatCurrency(totalOrder)}</td>
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
         <div class="value">${order.freight_responsibility || "DESTINATÁRIO (FOB)"}</div>
       </div>
       <div class="col">
         <div class="label">TRANSPORTADORA</div>
         <div class="value">${order.shipping_company_name || "---"}</div>
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
