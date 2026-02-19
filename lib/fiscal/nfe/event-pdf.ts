import bwipjs from "bwip-js";
import { chromium } from "playwright";
import { logger } from "@/lib/logger";
import { CCE_USAGE_CONDITIONS } from "@/lib/fiscal/nfe/correction-letter-rules";

export type NfeEventType = "cancellation" | "correction_letter";

export interface NfeEventPdfInput {
    type: NfeEventType;
    sequence: number | null;
    status: string | null;
    cStat: string | null;
    xMotivo: string | null;
    protocol: string | null;
    occurredAt: string | null;
    accessKey: string | null;
    nfeNumber: number | null;
    nfeSeries: number | null;
    nfeProtocol: string | null;
    nfeStatus: string | null;
    reason: string | null;
    correctionText: string | null;
    requestXml: string | null;
    responseXml: string | null;
    emitter: {
        legalName: string | null;
        tradeName: string | null;
        cnpj: string | null;
        ie: string | null;
        phone: string | null;
        email: string | null;
        addressStreet: string | null;
        addressNumber: string | null;
        addressComplement: string | null;
        addressNeighborhood: string | null;
        addressCity: string | null;
        addressState: string | null;
        addressZip: string | null;
    };
    recipient: {
        name: string | null;
        documentNumber: string | null;
        ie: string | null;
    } | null;
    document: {
        number: number | null;
        totalAmount: number | null;
    } | null;
    environment: string | null;
    generatedAt: string;
    logoUrl?: string | null;
}

type PreparedEventPdfInput = NfeEventPdfInput & {
    logoDataUri: string | null;
    barcodeDataUri: string | null;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function onlyDigits(value: string | null | undefined): string {
    return String(value || "").replace(/\D/g, "");
}

function formatDocument(value: string | null | undefined): string {
    const digits = onlyDigits(value);
    if (digits.length === 11) {
        return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    if (digits.length === 14) {
        return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return value?.trim() || "-";
}

function formatZipCode(value: string | null | undefined): string {
    const digits = onlyDigits(value);
    if (digits.length === 8) {
        return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    }
    return value?.trim() || "";
}

function formatAccessKey(value: string | null | undefined): string {
    const digits = onlyDigits(value);
    if (!digits) return "-";
    return digits.replace(/(\d{4})/g, "$1 ").trim();
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR");
}

function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(value));
}

function getStatusLabel(status: string | null | undefined): string {
    if (status === "authorized") return "Autorizado";
    if (status === "pending") return "Na fila";
    if (status === "processing") return "Processando";
    if (status === "rejected") return "Rejeitado";
    if (status === "failed") return "Falhou";
    if (status === "cancelled") return "Cancelado";
    return status?.trim() || "-";
}

function getStatusClass(status: string | null | undefined): string {
    if (status === "authorized") return "status-success";
    if (status === "pending") return "status-pending";
    if (status === "processing") return "status-info";
    if (status === "rejected" || status === "failed") return "status-danger";
    return "status-muted";
}

function getEventTypeLabel(type: NfeEventType): string {
    return type === "cancellation" ? "Cancelamento" : "Carta de Correcao";
}

function normalizeMultiline(value: string): string {
    return value
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>");
}

function resolveWatermarkText(input: NfeEventPdfInput): string | null {
    if (input.environment === "2") return "AMBIENTE DE HOMOLOGACAO";
    if ((input.status || "").toLowerCase() !== "authorized") return "EVENTO NAO AUTORIZADO";
    return null;
}

async function fetchLogoAsDataUri(logoUrl?: string | null): Promise<string | null> {
    if (!logoUrl) return null;
    if (logoUrl.startsWith("data:image/")) {
        return logoUrl;
    }
    try {
        const response = await fetch(logoUrl);
        if (!response.ok) {
            logger.warn("[NFE Event PDF] logo fetch failed", { status: response.status });
            return null;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const mimeType = response.headers.get("content-type") || "image/png";
        return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch (error: any) {
        logger.warn("[NFE Event PDF] logo fetch error", { message: error?.message || "unknown error" });
        return null;
    }
}

async function generateBarcodeDataUri(accessKey: string | null | undefined): Promise<string | null> {
    const digits = onlyDigits(accessKey);
    if (!digits) return null;
    try {
        const buffer = await bwipjs.toBuffer({
            bcid: "code128",
            text: digits,
            scale: 2,
            height: 11,
            includetext: false,
            textxalign: "center",
        });
        return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch (error: any) {
        logger.warn("[NFE Event PDF] barcode generation error", { message: error?.message || "unknown error" });
        return null;
    }
}

function renderEventPdfHtml(input: PreparedEventPdfInput): string {
    const watermark = resolveWatermarkText(input);
    const detailLabel = input.type === "cancellation" ? "MOTIVO DO CANCELAMENTO" : "TEXTO DA CARTA DE CORRECAO";
    const detailText = input.type === "cancellation"
        ? (input.reason || "Motivo nao informado.")
        : (input.correctionText || "Texto de correcao nao informado.");
    const emitterStreet = (input.emitter.addressStreet || "").trim();
    const emitterNumber = (input.emitter.addressNumber || "").trim();
    const emitterNeighborhood = (input.emitter.addressNeighborhood || "").trim();
    const emitterCity = (input.emitter.addressCity || "").trim();
    const emitterState = (input.emitter.addressState || "").trim();
    const emitterZip = formatZipCode(input.emitter.addressZip);
    const emitterAddressLine1 = [emitterStreet, emitterNumber].filter(Boolean).join(", ");
    const emitterAddressWithNeighborhood = [emitterAddressLine1, emitterNeighborhood].filter(Boolean).join(" - ");
    const emitterAddressLine2Parts = [
        emitterCity && emitterState ? `${emitterCity}/${emitterState}` : (emitterCity || emitterState),
        emitterZip ? `CEP ${emitterZip}` : "",
    ].filter(Boolean);
    const emitterAddressLine2 = emitterAddressLine2Parts.join(" - ");
    const emittedNfeNumber = input.nfeNumber ? String(input.nfeNumber) : "-";
    const emittedNfeSeries = input.nfeSeries ? String(input.nfeSeries) : "-";
    const eventTypeSubtitle = input.type === "cancellation"
        ? "Cancelamento de NF-e"
        : "Carta de Correcao Eletronica";
    const recipientName = input.recipient?.name || "-";
    const recipientDoc = formatDocument(input.recipient?.documentNumber || null);
    const eventResponse = input.xMotivo || "Sem retorno detalhado.";
    const eventProtocol = input.protocol || "-";
    const cStat = input.cStat || "-";
    const accessKeyFormatted = formatAccessKey(input.accessKey);
    const generatedAt = formatDateTime(input.generatedAt);
    const occurredAt = formatDateTime(input.occurredAt);
    const correctionLetterLegalText = input.type === "correction_letter" ? CCE_USAGE_CONDITIONS : null;

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        @page {
            size: 210mm 297mm;
            margin: 2mm;
        }

        body {
            font-family: 'Inter', Arial, sans-serif;
            font-size: 8pt;
            color: #111827;
            line-height: 1.25;
            background: #fff;
        }

        .page {
            width: 206mm;
            min-height: 292mm;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .border { border: 0.5mm solid #000; }
        .border-thin { border: 0.2mm solid #000; }
        .border-right { border-right: 0.2mm solid #000; }
        .section-title {
            background: #000;
            color: #fff;
            font-size: 6.6pt;
            font-weight: 700;
            padding: 0.6mm 1.2mm;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        /* Igual ao DANFE: barra preta colada no grid abaixo.
           O respiro ocorre apenas antes de cada novo bloco de seção. */
        .header + .section-title,
        .grid + .section-title,
        .event-detail + .section-title {
            margin-top: 1.2mm;
        }

        .header {
            display: flex;
            border: 0.5mm solid #000;
            height: 32mm;
        }

        .emit-box {
            width: 65mm;
            border-right: 0.2mm solid #000;
            padding: 0.5mm;
        }

        .emit-inner {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 1.5mm;
        }

        .emit-logo {
            width: 50mm;
            height: 15mm;
            margin-bottom: 1mm;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .emit-logo.without-logo {
            border: 0.3mm solid #ddd;
        }

        .emit-logo img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .emit-fallback {
            color: #999;
            font-size: 8pt;
            font-weight: 700;
        }

        .emit-name {
            font-size: 6pt;
            font-weight: 700;
            line-height: 1.1;
            margin-bottom: 0.5mm;
            text-align: center;
        }

        .emit-address {
            font-size: 5pt;
            line-height: 1.2;
            margin-bottom: 0.5mm;
            text-align: center;
        }

        .emit-doc {
            font-size: 5pt;
            font-weight: 600;
            line-height: 1.2;
            text-align: center;
        }

        .title-box {
            flex: 1;
            border-right: 0.2mm solid #000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            padding: 1mm 0;
        }

        .doc-tag {
            font-size: 12pt;
            font-weight: 800;
            letter-spacing: 0.02em;
            margin-bottom: 0.5mm;
        }

        .doc-title {
            font-size: 8pt;
            font-weight: 600;
            line-height: 1.2;
            max-width: 36mm;
        }

        .doc-subtitle {
            font-size: 7pt;
            color: #111827;
            line-height: 1.2;
            max-width: 36mm;
        }

        .doc-bottom-line {
            font-size: 8pt;
            font-weight: 700;
        }

        .barcode-box {
            width: 105mm;
            padding: 1.2mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 1mm;
        }

        .barcode-wrapper {
            min-height: 14mm;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .barcode-wrapper img {
            display: block;
            width: 100%;
            max-width: 100%;
            max-height: 12mm;
            object-fit: contain;
        }

        .access-key {
            font-size: 7pt;
            font-weight: 700;
            letter-spacing: 0.28mm;
            text-align: center;
            line-height: 1.2;
        }

        .access-caption {
            font-size: 5.6pt;
            text-align: center;
            text-transform: uppercase;
            color: #374151;
            font-weight: 600;
        }

        .grid {
            display: grid;
            border: 0.2mm solid #000;
            border-top: none;
        }

        .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

        .field {
            min-height: 10.5mm;
            padding: 0.8mm 1mm;
            border-right: 0.2mm solid #000;
            border-top: 0.2mm solid #000;
        }

        /* Quando há grids empilhados na mesma seção, evita linha dupla entre eles */
        .grid + .grid .field {
            border-top: none;
        }

        .field:nth-child(4n) { border-right: none; }
        .grid-3 .field:nth-child(3n) { border-right: none; }
        .grid-2 .field:nth-child(2n) { border-right: none; }

        .field-label {
            font-size: 5.4pt;
            color: #374151;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 0.4mm;
        }

        .field-value {
            font-size: 8pt;
            font-weight: 600;
            color: #111827;
            word-break: break-word;
            white-space: pre-wrap;
        }

        .mono { font-family: "Courier New", monospace; font-size: 7.2pt; }

        .status-pill {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 0.45mm 1.8mm;
            font-size: 7pt;
            font-weight: 700;
            width: fit-content;
            text-transform: uppercase;
        }

        .status-success { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-info { background: #dbeafe; color: #1d4ed8; }
        .status-danger { background: #fee2e2; color: #b91c1c; }
        .status-muted { background: #e5e7eb; color: #374151; }

        .event-detail {
            border: 0.2mm solid #000;
            border-top: none;
            padding: 1.2mm;
            min-height: 26mm;
        }

        .event-detail .field-value {
            font-size: 8.4pt;
            line-height: 1.35;
        }

        .legal-note {
            border: 0.2mm solid #000;
            border-top: none;
            padding: 1.2mm;
            min-height: 14mm;
        }

        .legal-note .field-value {
            font-size: 7.2pt;
            line-height: 1.3;
            font-weight: 500;
        }

        .footer {
            margin-top: auto;
            border: 0.2mm solid #000;
            padding: 0.8mm 1mm;
            font-size: 6pt;
            color: #374151;
            display: flex;
            justify-content: space-between;
            gap: 2mm;
        }

        .watermark {
            position: fixed;
            top: 49%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-36deg);
            font-size: 60pt;
            font-weight: 800;
            color: rgba(220, 38, 38, 0.08);
            z-index: 9999;
            white-space: nowrap;
            pointer-events: none;
        }
    `;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <style>${css}</style>
</head>
<body>
    ${watermark ? `<div class="watermark">${escapeHtml(watermark)}</div>` : ""}
    <div class="page">
        <div class="header">
            <div class="emit-box">
                <div class="emit-inner">
                    <div class="emit-logo ${input.logoDataUri ? "" : "without-logo"}">
                        ${input.logoDataUri
            ? `<img src="${input.logoDataUri}" alt="Logo emitente" />`
            : `<span class="emit-fallback">LOGO</span>`
        }
                    </div>
                    <div class="emit-name">${escapeHtml(input.emitter.legalName || input.emitter.tradeName || "-")}</div>
                    <div class="emit-address">
                        ${escapeHtml(emitterAddressWithNeighborhood || "-")}<br>
                        ${escapeHtml(emitterAddressLine2 || "-")}
                    </div>
                    <div class="emit-doc">
                        CNPJ: ${escapeHtml(formatDocument(input.emitter.cnpj))} | IE: ${escapeHtml(input.emitter.ie || "-")}
                    </div>
                </div>
            </div>

            <div class="title-box">
                <div>
                    <div class="doc-tag">DAE</div>
                    <div class="doc-title">Documento Auxiliar de Evento</div>
                    <div class="doc-subtitle">${escapeHtml(eventTypeSubtitle)}</div>
                </div>
                <div style="text-align: center; margin-bottom: 0;">
                    <div class="doc-bottom-line">Nº ${escapeHtml(emittedNfeNumber)}</div>
                    <div class="doc-bottom-line">SÉRIE ${escapeHtml(emittedNfeSeries)}</div>
                </div>
            </div>

            <div class="barcode-box">
                <div class="barcode-wrapper">
                    ${input.barcodeDataUri ? `<img src="${input.barcodeDataUri}" alt="Codigo de barras da chave" />` : ""}
                </div>
                <div class="access-caption">Chave de acesso</div>
                <div class="access-key">${escapeHtml(accessKeyFormatted)}</div>
            </div>
        </div>

        <div class="section-title">Identificacao do Evento</div>
        <div class="grid grid-4">
            <div class="field">
                <div class="field-label">Tipo</div>
                <div class="field-value">${escapeHtml(getEventTypeLabel(input.type))}</div>
            </div>
            <div class="field">
                <div class="field-label">Status</div>
                <div class="field-value"><span class="status-pill ${getStatusClass(input.status)}">${escapeHtml(getStatusLabel(input.status))}</span></div>
            </div>
            <div class="field">
                <div class="field-label">Sequencia</div>
                <div class="field-value">#${escapeHtml(String(input.sequence || 1))}</div>
            </div>
            <div class="field">
                <div class="field-label">Data/Hora do Evento</div>
                <div class="field-value">${escapeHtml(occurredAt)}</div>
            </div>
        </div>

        <div class="grid grid-3">
            <div class="field">
                <div class="field-label">Codigo de retorno (cStat)</div>
                <div class="field-value">${escapeHtml(cStat)}</div>
            </div>
            <div class="field">
                <div class="field-label">Protocolo do evento</div>
                <div class="field-value mono">${escapeHtml(eventProtocol)}</div>
            </div>
            <div class="field">
                <div class="field-label">Retorno da SEFAZ</div>
                <div class="field-value">${escapeHtml(eventResponse)}</div>
            </div>
        </div>

        <div class="section-title">Dados da NF-e</div>
        <div class="grid grid-4">
            <div class="field">
                <div class="field-label">Numero NF-e</div>
                <div class="field-value">${escapeHtml(input.nfeNumber ? String(input.nfeNumber) : "-")}</div>
            </div>
            <div class="field">
                <div class="field-label">Serie</div>
                <div class="field-value">${escapeHtml(input.nfeSeries ? String(input.nfeSeries) : "-")}</div>
            </div>
            <div class="field">
                <div class="field-label">Status NF-e</div>
                <div class="field-value">${escapeHtml(getStatusLabel(input.nfeStatus || "-"))}</div>
            </div>
            <div class="field">
                <div class="field-label">Protocolo de autorizacao</div>
                <div class="field-value mono">${escapeHtml(input.nfeProtocol || "-")}</div>
            </div>
        </div>

        <div class="section-title">Destinatario</div>
        <div class="grid grid-3" style="grid-template-columns: 2fr 1fr 1fr;">
            <div class="field">
                <div class="field-label">Cliente</div>
                <div class="field-value">${escapeHtml(recipientName)}</div>
            </div>
            <div class="field">
                <div class="field-label">Documento</div>
                <div class="field-value">${escapeHtml(recipientDoc)}</div>
            </div>
            <div class="field">
                <div class="field-label">Total do pedido</div>
                <div class="field-value">${escapeHtml(formatCurrency(input.document?.totalAmount))}</div>
            </div>
        </div>

        <div class="section-title">${escapeHtml(detailLabel)}</div>
        <div class="event-detail">
            <div class="field-value">${normalizeMultiline(detailText)}</div>
        </div>

        ${correctionLetterLegalText ? `
        <div class="section-title">Condicoes de Uso da CC-e</div>
        <div class="legal-note">
            <div class="field-value">${escapeHtml(correctionLetterLegalText)}</div>
        </div>
        ` : ""}

        <div class="footer">
            <span>Gerado em: ${escapeHtml(generatedAt)}</span>
            <span>Documento auxiliar para consulta interna do evento da NF-e</span>
        </div>
    </div>
</body>
</html>`;
}

export async function generateNfeEventPdf(input: NfeEventPdfInput): Promise<Buffer> {
    const [logoDataUri, barcodeDataUri] = await Promise.all([
        fetchLogoAsDataUri(input.logoUrl),
        generateBarcodeDataUri(input.accessKey),
    ]);

    const html = renderEventPdfHtml({
        ...input,
        logoDataUri,
        barcodeDataUri,
    });

    const browser = await chromium.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle" });
        await page.emulateMedia({ media: "print" });
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "0.5cm",
                right: "0.5cm",
                bottom: "0.5cm",
                left: "0.5cm",
            },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
