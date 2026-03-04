import { format } from "date-fns";
import type { InventoryCountLine, InventoryCountPrintData } from "@/lib/inventory/inventory-counts";

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

interface InventoryCountPrintablePage {
  categoryLabel: string;
  categoryPageIndex: number;
  categoryPageTotal: number;
  lines: InventoryCountLine[];
}

const MAX_LINES_PER_PAGE = 24;

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

function chunkLines(lines: InventoryCountLine[], size: number): InventoryCountLine[][] {
  if (lines.length === 0) return [];

  const chunks: InventoryCountLine[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks;
}

function buildPrintablePages(inventory: InventoryCountPrintData): InventoryCountPrintablePage[] {
  const pages: InventoryCountPrintablePage[] = [];

  for (const category of inventory.categories) {
    const chunks = chunkLines(category.lines, MAX_LINES_PER_PAGE);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      pages.push({
        categoryLabel: category.label,
        categoryPageIndex: chunkIndex + 1,
        categoryPageTotal: chunks.length,
        lines: chunks[chunkIndex] ?? [],
      });
    }
  }

  return pages;
}

function renderCategoryTitle(page: InventoryCountPrintablePage): string {
  if (page.categoryPageTotal <= 1) {
    return page.categoryLabel;
  }

  return `${page.categoryLabel} (parte ${page.categoryPageIndex}/${page.categoryPageTotal})`;
}

export function renderInventoryCountA4Html(input: RenderInventoryCountA4Input): string {
  const { company, inventory } = input;
  const printableDate = formatInventoryDate(inventory.countedAt);
  const inventoryNumber = resolveInventoryNumber(inventory.number);
  const pages = buildPrintablePages(inventory);
  const totalPages = pages.length > 0 ? pages.length : 1;

  const pagesHtml = (pages.length > 0 ? pages : [{
    categoryLabel: "Sem itens elegíveis",
    categoryPageIndex: 1,
    categoryPageTotal: 1,
    lines: [] as InventoryCountLine[],
  }]).map((page, pageIndex) => `
    <section class="page">
      <div class="header-box">
        <div class="header-left">
          ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" class="company-logo" alt="Logo" />` : ""}
          <div class="company-name">${escapeHtml(company.tradeName ?? company.legalName)}</div>
          <p class="company-line"><strong>${escapeHtml(company.legalName)}</strong></p>
          <p class="company-line">${escapeHtml(company.streetLine)}</p>
          <p class="company-line">${escapeHtml(company.cityStateLine)}</p>
        </div>
        <div class="header-right">
          <p class="header-title">Folha de Contagem de Inventário</p>
          <p class="header-subtitle">Inventário #${inventoryNumber}</p>
          <p class="header-meta">Data da contagem: ${printableDate}</p>
          <p class="header-meta">Total de itens: ${inventory.totalItems}</p>
          <p class="header-meta">CNPJ: ${escapeHtml(company.document)}</p>
          <p class="header-meta">Folha ${pageIndex + 1}/${totalPages}</p>
        </div>
      </div>

      <div class="category-box">
        <div class="section-title">${escapeHtml(renderCategoryTitle(page))} (${page.lines.length} itens)</div>
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
            ${page.lines.length > 0
              ? page.lines.map((line) => `
                <tr>
                  <td>${escapeHtml(line.itemSku ?? "S/ SKU")}</td>
                  <td>${escapeHtml(line.itemName)}</td>
                  <td>${escapeHtml(line.uom ?? "UN")}</td>
                  <td><div class="manual-cell"></div></td>
                  <td><div class="notes-cell"></div></td>
                </tr>
              `).join("")
              : `<tr><td colspan="5" class="empty-cell">Nenhum item para esta categoria.</td></tr>`
            }
          </tbody>
        </table>
      </div>

      <div class="footer">
        <span>Observações gerais: ${escapeHtml(inventory.notes ?? "___________________________________________")}</span>
        <span>Assinatura: ___________________________________________</span>
      </div>
    </section>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Inventário ${inventoryNumber}</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Liberation Sans", sans-serif;
      color: #1f2937;
      font-size: 10px;
      line-height: 1.2;
      background: #fff;
    }
    .page {
      box-sizing: border-box;
      width: 210mm;
      min-height: 297mm;
      padding: 10mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .header-box {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .header-left {
      width: 48%;
      text-align: center;
      border-right: 1px solid #e5e7eb;
      padding-right: 10px;
    }
    .header-right {
      width: 52%;
      text-align: center;
      padding-left: 10px;
    }
    .company-logo {
      max-height: 40px;
      margin-bottom: 2px;
    }
    .company-name {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .company-line {
      margin: 0;
      line-height: 1.2;
      font-size: 10px;
    }
    .header-title {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .header-subtitle {
      margin: 2px 0 4px 0;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .header-meta {
      margin: 0;
      line-height: 1.2;
      font-size: 10px;
      text-transform: uppercase;
    }
    .category-box {
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      padding: 7px;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e7eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
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
    .text-center {
      text-align: center;
    }
    .manual-cell,
    .notes-cell {
      height: 22px;
      border: 1px solid #cfcfcf;
      border-radius: 12px;
      background: #fff;
    }
    .empty-cell {
      text-align: center;
      color: #6b7280;
      padding: 12px 8px;
      font-style: italic;
    }
    .footer {
      margin-top: auto;
      border-top: 1px solid #d9d9d9;
      padding-top: 6px;
      font-size: 9px;
      color: #4b5563;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
`;
}
