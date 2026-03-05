import { XMLParser } from "fast-xml-parser";
import { decodeInboundXml } from "@/lib/fiscal/inbound/xml-utils";
import {
  NormalizedDfeDoc,
  NormalizedDfeDocSchema,
} from "@/lib/fiscal/inbound/schemas";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
});

type JsonRecord = Record<string, unknown>;

type NormalizeInput = {
  nsu: string;
  schema: string;
  xmlBase64?: string | null;
  xmlIsGz?: boolean;
  summaryJson?: Record<string, unknown>;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function pickRecordPath(root: JsonRecord | null, path: string[]): JsonRecord | null {
  let cursor: unknown = root;
  for (const segment of path) {
    const record = asRecord(cursor);
    if (!record) return null;
    cursor = record[segment];
  }
  return asRecord(cursor);
}

function pickString(root: JsonRecord | null, path: string[]): string | null {
  let cursor: unknown = root;
  for (const segment of path) {
    const record = asRecord(cursor);
    if (!record) return null;
    cursor = record[segment];
  }

  if (typeof cursor !== "string") return null;
  const value = cursor.trim();
  return value.length > 0 ? value : null;
}

function digits(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\D/g, "");
  return normalized.length > 0 ? normalized : null;
}

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseDecimal(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFullXml(root: JsonRecord | null): boolean {
  if (!root) return false;
  return Boolean(root.nfeProc) || Boolean(root.procNFe) || Boolean(root.NFe) || Boolean(root.infNFe);
}

function resolveSummaryRoot(parsed: JsonRecord, schema: string): JsonRecord | null {
  if (schema === "resNFe") {
    return asRecord(parsed.resNFe) || asRecord(parsed.docZip);
  }

  if (schema === "resEvento") {
    return asRecord(parsed.resEvento) || asRecord(parsed.docZip);
  }

  if (schema === "procNFe" || schema === "nfeProc") {
    const proc = asRecord(parsed.nfeProc) || asRecord(parsed.procNFe);
    if (proc) return proc;
    return asRecord(parsed.NFe) || asRecord(parsed.infNFe);
  }

  return asRecord(parsed[schema]) || parsed;
}

function extractFromResNfe(summary: JsonRecord | null): {
  chnfe: string | null;
  emitCnpj: string | null;
  emitNome: string | null;
  destCnpj: string | null;
  dhEmi: string | null;
  total: number | null;
} {
  const summaryRecord = summary || {};
  const chnfe = digits(pickString(summaryRecord, ["chNFe"]));
  const emitCnpj = digits(pickString(summaryRecord, ["CNPJ"]));
  const emitNome = pickString(summaryRecord, ["xNome"]);
  const destCnpj = digits(pickString(summaryRecord, ["CNPJDest"]));
  const dhEmi = toIsoOrNull(pickString(summaryRecord, ["dhEmi"]));
  const total = parseDecimal(pickString(summaryRecord, ["vNF"]));

  return {
    chnfe: chnfe && chnfe.length === 44 ? chnfe : null,
    emitCnpj: emitCnpj && emitCnpj.length === 14 ? emitCnpj : null,
    emitNome,
    destCnpj: destCnpj && destCnpj.length === 14 ? destCnpj : null,
    dhEmi,
    total,
  };
}

function extractFromProcNfe(summary: JsonRecord | null): {
  chnfe: string | null;
  emitCnpj: string | null;
  emitNome: string | null;
  destCnpj: string | null;
  dhEmi: string | null;
  total: number | null;
} {
  const proc = summary;
  const infNFe =
    pickRecordPath(proc, ["NFe", "infNFe"]) ||
    pickRecordPath(proc, ["infNFe"]) ||
    pickRecordPath(proc, ["nfeProc", "NFe", "infNFe"]) ||
    null;

  const ide = pickRecordPath(infNFe, ["ide"]);
  const emit = pickRecordPath(infNFe, ["emit"]);
  const dest = pickRecordPath(infNFe, ["dest"]);
  const icmsTot = pickRecordPath(infNFe, ["total", "ICMSTot"]);

  const rawChnfe =
    digits(pickString(infNFe, ["@_Id"])?.replace(/^NFe/i, "")) ||
    digits(pickString(pickRecordPath(proc, ["protNFe", "infProt"]), ["chNFe"]));

  const emitCnpj = digits(pickString(emit, ["CNPJ"]));
  const destCnpj = digits(pickString(dest, ["CNPJ"]));

  return {
    chnfe: rawChnfe && rawChnfe.length === 44 ? rawChnfe : null,
    emitCnpj: emitCnpj && emitCnpj.length === 14 ? emitCnpj : null,
    emitNome: pickString(emit, ["xNome"]),
    destCnpj: destCnpj && destCnpj.length === 14 ? destCnpj : null,
    dhEmi: toIsoOrNull(pickString(ide, ["dhEmi"]) || pickString(ide, ["dEmi"])),
    total: parseDecimal(pickString(icmsTot, ["vNF"])),
  };
}

function extractFromResEvento(summary: JsonRecord | null): {
  chnfe: string | null;
  emitCnpj: string | null;
  emitNome: string | null;
  destCnpj: string | null;
  dhEmi: string | null;
  total: number | null;
} {
  const chnfe = digits(pickString(summary, ["chNFe"]));
  return {
    chnfe: chnfe && chnfe.length === 44 ? chnfe : null,
    emitCnpj: null,
    emitNome: pickString(summary, ["xNome"]),
    destCnpj: null,
    dhEmi: toIsoOrNull(pickString(summary, ["dhEvento"])),
    total: null,
  };
}

export function normalizeDistributionDoc(input: NormalizeInput): NormalizedDfeDoc {
  const baseSummary = input.summaryJson ?? {};
  let extractedXml: string | null = null;
  let parsedXml: JsonRecord | null = null;

  if (input.xmlBase64) {
    extractedXml = decodeInboundXml({
      xmlBase64: input.xmlBase64,
      xmlIsGz: input.xmlIsGz ?? false,
    });
    const parsed = parser.parse(extractedXml);
    parsedXml = asRecord(parsed);
  }

  const summaryRoot = parsedXml ? resolveSummaryRoot(parsedXml, input.schema) : null;

  let fields: {
    chnfe: string | null;
    emitCnpj: string | null;
    emitNome: string | null;
    destCnpj: string | null;
    dhEmi: string | null;
    total: number | null;
  };

  if (input.schema === "resNFe") {
    fields = extractFromResNfe(summaryRoot);
  } else if (input.schema === "procNFe" || input.schema === "nfeProc") {
    fields = extractFromProcNfe(summaryRoot);
  } else if (input.schema === "resEvento") {
    fields = extractFromResEvento(summaryRoot);
  } else {
    fields = {
      chnfe: digits(pickString(summaryRoot, ["chNFe"])) ?? null,
      emitCnpj: digits(pickString(summaryRoot, ["CNPJ"])) ?? null,
      emitNome: pickString(summaryRoot, ["xNome"]),
      destCnpj: digits(pickString(summaryRoot, ["CNPJDest"])) ?? null,
      dhEmi: toIsoOrNull(pickString(summaryRoot, ["dhEmi"])),
      total: parseDecimal(pickString(summaryRoot, ["vNF"])),
    };
  }

  const normalized = NormalizedDfeDocSchema.parse({
    nsu: input.nsu,
    schema: input.schema,
    chnfe: fields.chnfe,
    emitCnpj: fields.emitCnpj,
    emitNome: fields.emitNome,
    destCnpj: fields.destCnpj,
    dhEmi: fields.dhEmi,
    total: fields.total,
    summaryJson: {
      ...baseSummary,
      sourceSchema: input.schema,
      extracted: fields,
    },
    xmlBase64: input.xmlBase64 ?? null,
    xmlIsGz: input.xmlIsGz ?? false,
    hasFullXml: isFullXml(parsedXml),
  });

  return normalized;
}

export function mapNormalizedDocToRpcRow(doc: NormalizedDfeDoc): Record<string, unknown> {
  return {
    nsu: doc.nsu,
    schema: doc.schema,
    chnfe: doc.chnfe ?? null,
    emit_cnpj: doc.emitCnpj ?? null,
    emit_nome: doc.emitNome ?? null,
    dest_cnpj: doc.destCnpj ?? null,
    dh_emi: doc.dhEmi ?? null,
    total: doc.total ?? null,
    summary_json: doc.summaryJson,
    xml_base64: doc.xmlBase64 ?? null,
    xml_is_gz: doc.xmlIsGz,
    has_full_xml: doc.hasFullXml,
    manifest_status: doc.manifestStatus,
    manifest_updated_at: doc.manifestUpdatedAt ?? null,
  };
}
