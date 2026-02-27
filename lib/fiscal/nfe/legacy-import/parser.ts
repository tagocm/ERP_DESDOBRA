import { XMLParser } from "fast-xml-parser";
import {
    ParsedNfeXmlDocument,
    ParsedNfeXmlDocumentSchema,
    ParsedNfeXmlItem,
} from "@/lib/fiscal/nfe/legacy-import/schemas";

type JsonRecord = Record<string, unknown>;

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    removeNSPrefix: true,
});

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord | null {
    return isRecord(value) ? value : null;
}

function toArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

function pickString(record: JsonRecord | null, key: string): string | null {
    if (!record) return null;
    const value = record[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function pickNumber(record: JsonRecord | null, key: string): number | null {
    const raw = pickString(record, key);
    if (!raw) return null;
    const normalized = raw.replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

function sanitizeDigits(value: string | null, expectedLengths?: number[]): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, "");
    if (!digits) return null;
    if (expectedLengths && !expectedLengths.includes(digits.length)) return null;
    return digits;
}

function inferProducedFromCfop(cfop: string): boolean {
    const digits = cfop.replace(/\D/g, "");
    return digits.endsWith("101");
}

function normalizeUf(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim().toUpperCase();
    return normalized.length === 2 ? normalized : null;
}

function resolveNfeRoot(parsed: JsonRecord): { infNFe: JsonRecord; infProt: JsonRecord | null } {
    const nfeProc = asRecord(parsed.nfeProc);
    const rootNfe =
        asRecord(nfeProc?.NFe) ||
        asRecord(asRecord(parsed.enviNFe)?.NFe) ||
        asRecord(parsed.NFe) ||
        (asRecord(parsed.infNFe) ? ({ infNFe: parsed.infNFe } as JsonRecord) : null);

    const infNFe = asRecord(rootNfe?.infNFe);
    if (!infNFe) {
        throw new Error("Estrutura XML inválida: tag infNFe não encontrada.");
    }

    const infProt =
        asRecord(asRecord(nfeProc?.protNFe)?.infProt) ||
        asRecord(asRecord(parsed.protNFe)?.infProt) ||
        null;

    return { infNFe, infProt };
}

function parseItems(infNFe: JsonRecord): ParsedNfeXmlItem[] {
    const detRows = toArray(infNFe.det);
    const parsedItems: ParsedNfeXmlItem[] = detRows.map((detRaw, index) => {
        const det = asRecord(detRaw);
        const prod = asRecord(det?.prod);

        const nItemFromAttr = pickString(det, "@_nItem");
        const itemNumber = Number(nItemFromAttr || index + 1);
        if (!Number.isFinite(itemNumber) || itemNumber <= 0) {
            throw new Error(`Item com nItem inválido na posição ${index + 1}.`);
        }

        const cfopRaw = pickString(prod, "CFOP");
        const cfop = sanitizeDigits(cfopRaw, [4]);
        if (!cfop) {
            throw new Error(`CFOP inválido no item ${itemNumber}.`);
        }

        const qCom = pickNumber(prod, "qCom");
        const vUnCom = pickNumber(prod, "vUnCom");
        const vProd = pickNumber(prod, "vProd");
        if (qCom === null || qCom <= 0) {
            throw new Error(`Quantidade inválida no item ${itemNumber}.`);
        }
        if (vUnCom === null || vUnCom < 0) {
            throw new Error(`Valor unitário inválido no item ${itemNumber}.`);
        }
        if (vProd === null || vProd < 0) {
            throw new Error(`Valor total inválido no item ${itemNumber}.`);
        }

        const cProd = pickString(prod, "cProd");
        const xProd = pickString(prod, "xProd");
        const ncm = pickString(prod, "NCM");
        const uCom = pickString(prod, "uCom");

        if (!cProd || !xProd || !ncm || !uCom) {
            throw new Error(`Campos obrigatórios ausentes no item ${itemNumber}.`);
        }

        return {
            itemNumber,
            cProd,
            xProd,
            ncm,
            cfop,
            uCom,
            qCom,
            vUnCom,
            vProd,
            isProduced: inferProducedFromCfop(cfop),
        };
    });

    if (parsedItems.length === 0) {
        throw new Error("XML sem itens (det/prod).");
    }

    return parsedItems;
}

export function parseLegacyNfeXml(xmlContent: string): ParsedNfeXmlDocument {
    const parsedRaw = xmlParser.parse(xmlContent);
    if (!isRecord(parsedRaw)) {
        throw new Error("XML inválido: estrutura raiz não reconhecida.");
    }

    const { infNFe, infProt } = resolveNfeRoot(parsedRaw);
    const ide = asRecord(infNFe.ide);
    const emit = asRecord(infNFe.emit);
    const dest = asRecord(infNFe.dest);

    const infNFeId = pickString(infNFe, "@_Id");
    const accessKeyFromId = sanitizeDigits(infNFeId?.replace(/^NFe/i, "") ?? null, [44]);
    const accessKeyFromProt = sanitizeDigits(pickString(infProt, "chNFe"), [44]);
    const accessKey = accessKeyFromProt ?? accessKeyFromId;
    if (!accessKey) {
        throw new Error("Chave de acesso inválida ou ausente.");
    }

    const number = pickString(ide, "nNF");
    const series = pickString(ide, "serie");
    const issuedAt = pickString(ide, "dhEmi") ?? pickString(ide, "dEmi");
    if (!number || !series || !issuedAt) {
        throw new Error("Número, série ou data de emissão ausentes no XML.");
    }

    const emitCnpj = sanitizeDigits(pickString(emit, "CNPJ"), [14]);
    const emitUf = normalizeUf(pickString(asRecord(emit?.enderEmit), "UF"));
    const emitName = pickString(emit, "xNome");
    if (!emitCnpj || !emitUf || !emitName) {
        throw new Error("Dados do emitente inválidos no XML.");
    }

    const destCnpj = sanitizeDigits(pickString(dest, "CNPJ"), [14]);
    const destCpf = sanitizeDigits(pickString(dest, "CPF"), [11]);
    const destDocument = destCnpj ?? destCpf;
    const destUf = normalizeUf(pickString(asRecord(dest?.enderDest), "UF"));
    const destName = pickString(dest, "xNome");
    if (!destDocument || !destUf || !destName) {
        throw new Error("Dados do destinatário inválidos no XML.");
    }

    const totalVnf = pickNumber(asRecord(asRecord(infNFe.total)?.ICMSTot), "vNF");
    if (totalVnf === null || totalVnf <= 0) {
        throw new Error("Valor total vNF inválido no XML.");
    }

    const cStat = pickString(infProt, "cStat");
    const xMotivo = pickString(infProt, "xMotivo");
    const nProt = pickString(infProt, "nProt");
    const hasProtocol = Boolean(infProt && cStat);

    const parsedDocument = {
        header: {
            accessKey,
            number,
            series,
            issuedAt,
            model: pickString(ide, "mod") ?? "55",
            tpAmb: (pickString(ide, "tpAmb") ?? pickString(infProt, "tpAmb") ?? "2") as "1" | "2",
            emitCnpj,
            emitUf,
            emitName,
            destDocument,
            destUf,
            destName,
            totalVnf,
        },
        protocol: {
            hasProtocol,
            nProt,
            cStat,
            xMotivo,
            status: hasProtocol && cStat === "100" ? "AUTHORIZED_WITH_PROTOCOL" : "SEM_PROTOCOLO",
        },
        items: parseItems(infNFe),
    };

    return ParsedNfeXmlDocumentSchema.parse(parsedDocument);
}
