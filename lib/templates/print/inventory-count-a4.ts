import { format } from "date-fns";
import type { InventoryCountPrintData } from "@/lib/inventory/inventory-counts";

interface InventoryPrintCompanyData {
  legalName: string;
  tradeName: string | null;
  document: string | null;
  streetLine: string | null;
  cityStateLine: string | null;
  logoUrl: string | null;
}

interface RenderInventoryCountA4Input {
  company: InventoryPrintCompanyData;
  inventory: InventoryCountPrintData;
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInventoryDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return format(parsed, "dd/MM/yyyy");
}

function resolveInventoryNumber(number: number | null): string {
  if (number === null) return "-";
  return String(number).padStart(6, "0");
}

export function renderInventoryCountPdfHeaderTemplate(input: RenderInventoryCountA4Input): string {
  const { company, inventory } = input;
  const printableDate = formatInventoryDate(inventory.countedAt);
  const inventoryNumber = resolveInventoryNumber(inventory.number);

  return `
<style>
  .inventory-print-header {
    font-family: Arial, "Liberation Sans", sans-serif;
    color: #0f172a;
    width: 100%;
    padding: 0 14px;
    box-sizing: border-box;
  }
  .inventory-print-header-box {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 10px;
  }
  .inventory-print-header-left {
    width: 48%;
    text-align: center;
    border-right: 1px solid #e5e7eb;
    padding-right: 10px;
  }
  .inventory-print-header-right {
    width: 52%;
    text-align: center;
    padding-left: 10px;
  }
  .inventory-print-company-name {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .inventory-print-company-line {
    margin: 0;
    line-height: 1.2;
    font-size: 10px;
  }
  .inventory-print-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .inventory-print-subtitle {
    margin: 2px 0 4px 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .inventory-print-meta {
    margin: 0;
    line-height: 1.2;
    font-size: 10px;
    text-transform: uppercase;
  }
</style>
<div class="inventory-print-header">
  <div class="inventory-print-header-box">
    <div class="inventory-print-header-left">
      <div class="inventory-print-company-name">${escapeHtml(company.tradeName ?? company.legalName)}</div>
      <p class="inventory-print-company-line"><strong>${escapeHtml(company.legalName)}</strong></p>
      <p class="inventory-print-company-line">${escapeHtml(company.streetLine)}</p>
      <p class="inventory-print-company-line">${escapeHtml(company.cityStateLine)}</p>
    </div>
    <div class="inventory-print-header-right">
      <p class="inventory-print-title">Folha de Contagem de Inventário</p>
      <p class="inventory-print-subtitle">Inventário #${inventoryNumber}</p>
      <p class="inventory-print-meta">Data da contagem: ${printableDate}</p>
      <p class="inventory-print-meta">Total de itens: ${inventory.totalItems}</p>
      <p class="inventory-print-meta">CNPJ: ${escapeHtml(company.document)}</p>
      <p class="inventory-print-meta">Folha <span class="pageNumber"></span>/<span class="totalPages"></span></p>
    </div>
  </div>
</div>
`;
}

export function renderInventoryCountA4Html(input: RenderInventoryCountA4Input): string {
  const { inventory } = input;
  const inventoryNumber = resolveInventoryNumber(inventory.number);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Inventário ${inventoryNumber}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { height: 100%; }
    body {
      font-family: Arial, "Liberation Sans", sans-serif;
      font-size: 10px;
      color: #333;
      line-height: 1.2;
      margin: 0;
    }
    .box {
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      margin-bottom: 8px;
      padding: 7px;
    }
    .row {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .col {
      flex: 1;
    }
    .text-center {
      text-align: center;
    }
    .text-right {
      text-align: right;
    }
    .header-title {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      color: #111;
      text-align: center;
      margin: 0;
    }
    .label {
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 2px;
    }
    .value {
      font-size: 10px;
      color: #000;
      margin: 0;
    }
    .value-strong {
      font-size: 14px;
      font-weight: bold;
      margin-top: 2px;
    }
    .section-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: #1f2937;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e7eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 9px;
    }
    th {
      border-bottom: 2px solid #d9d9d9;
      background: #f7f7f7;
      color: #4b5563;
      text-align: left;
      text-transform: uppercase;
      font-size: 8px;
      padding: 5px 4px;
    }
    td {
      border-bottom: 1px solid #ececec;
      padding: 5px 4px;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background-color: #fbfbfb;
    }
    .manual-cell {
      height: 22px;
      border: 1px solid #cfcfcf;
      border-radius: 12px;
      background: #fff;
    }
    .notes-cell {
      height: 22px;
      border: 1px solid #cfcfcf;
      border-radius: 12px;
      background: #fff;
    }
    .page-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer {
      border-top: 1px solid #d9d9d9;
      margin-top: 10px;
      padding-top: 6px;
      font-size: 9px;
      color: #4b5563;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  ${inventory.categories.map((category) => `
    <div class="box page-break">
      <div class="section-title">${escapeHtml(category.label)} (${category.lines.length} itens)</div>
      <table>
        <thead>
          <tr>
            <th style="width: 14%;">SKU</th>
            <th style="width: 46%;">Item</th>
            <th style="width: 10%;">UOM</th>
            <th style="width: 15%;" class="text-center">Contagem Física</th>
            <th style="width: 15%;" class="text-center">Observação</th>
          </tr>
        </thead>
        <tbody>
          ${category.lines.map((line) => `
            <tr>
              <td>${escapeHtml(line.itemSku ?? "S/ SKU")}</td>
              <td>${escapeHtml(line.itemName)}</td>
              <td>${escapeHtml(line.uom ?? "UN")}</td>
              <td><div class="manual-cell"></div></td>
              <td><div class="notes-cell"></div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `).join("")}

  <div class="footer">
    <span>Observações gerais: ${escapeHtml(inventory.notes ?? "___________________________________________")}</span>
    <span>Assinatura: ___________________________________________</span>
  </div>
</body>
</html>
`;
}
