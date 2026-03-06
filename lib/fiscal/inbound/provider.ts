import { logger } from "@/lib/logger";
import { normalizeDistributionDoc } from "@/lib/fiscal/inbound/normalize";
import {
  DfeEnvironment,
  DistProviderFetchResult,
  DistProviderFetchResultSchema,
  ManifestEventType,
  ManifestProviderResult,
  ManifestProviderResultSchema,
  NormalizedDfeDoc,
} from "@/lib/fiscal/inbound/schemas";
import { createAdminClient } from "@/lib/supabaseServer";
import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { soapRequest } from "@/lib/nfe/sefaz/soap/soapClient";
import { buildSoapEnvelope } from "@/lib/nfe/sefaz/soap/soapEnvelope";
import { getSefazUrl } from "@/lib/nfe/sefaz/endpoints";
import { signEventXml } from "@/lib/nfe/sign/signEventXml";
import { formatDateTimeInBrasilia } from "@/lib/nfe/sefaz/services/brasilia-time";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

export interface DfeProvider {
  fetchByNsu(args: {
    companyId: string;
    environment: DfeEnvironment;
    lastNsu: string;
    jobId?: string;
  }): Promise<DistProviderFetchResult>;
  sendManifest(args: {
    companyId: string;
    environment: DfeEnvironment;
    chNFe: string;
    eventType: ManifestEventType;
    justification?: string | null;
    jobId?: string;
  }): Promise<ManifestProviderResult>;
}

const StubDocConfigSchema = z.object({
  nsu: z.string().regex(/^\d+$/),
  schema: z.string().min(1),
  xmlBase64: z.string().min(1).optional(),
  xmlIsGz: z.boolean().default(false),
  summaryJson: z.record(z.string(), z.unknown()).optional(),
});

const CompanySettingsIdentityRowSchema = z.object({
  cnpj: z.string().nullable().optional(),
  address_state: z.string().nullable().optional(),
});

const DistDocZipSchema = z.object({
  nsu: z.string().regex(/^\d+$/),
  schema: z.string().min(1),
  xmlBase64: z.string().min(1),
});

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
});

const DIST_ENDPOINTS: Record<DfeEnvironment, string> = {
  production: "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  homologation: "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
};

const DIST_SOAP_ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
const EVENT_SOAP_ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF";
const DIST_WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";

const MANIFEST_EVENT_CONFIG: Record<
  ManifestEventType,
  { code: string; description: string; requiresJustification: boolean }
> = {
  CIENCIA: { code: "210210", description: "Ciencia da Operacao", requiresJustification: false },
  CONFIRMACAO: { code: "210200", description: "Confirmacao da Operacao", requiresJustification: false },
  DESCONHECIMENTO: { code: "210220", description: "Desconhecimento da Operacao", requiresJustification: false },
  NAO_REALIZADA: { code: "210240", description: "Operacao nao Realizada", requiresJustification: true },
};

const UF_TO_CODE: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getPath(root: unknown, path: string[]): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    const record = asRecord(cursor);
    if (!record) return undefined;
    cursor = record[key];
  }
  return cursor;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeNsu(value: string | null | undefined): string {
  const digits = toDigits(value);
  return digits.length > 0 ? digits : "0";
}

function padNsu15(value: string | null | undefined): string {
  return normalizeNsu(value).padStart(15, "0").slice(-15);
}

function toTpAmb(environment: DfeEnvironment): "1" | "2" {
  return environment === "production" ? "1" : "2";
}

function compareNsu(a: string, b: string): number {
  const normalizedA = normalizeNsu(a);
  const normalizedB = normalizeNsu(b);
  try {
    const aBig = BigInt(normalizedA);
    const bBig = BigInt(normalizedB);
    if (aBig === bBig) return 0;
    return aBig > bBig ? 1 : -1;
  } catch {
    if (normalizedA === normalizedB) return 0;
    return normalizedA > normalizedB ? 1 : -1;
  }
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSignedEventXmlForSoap(input: string): string {
  return input.replace(/^\s*<\?xml[^>]*\?>\s*/i, "").trim();
}

function buildDistSoapEnvelope(args: {
  ufCode: string;
  bodyXml: string;
}): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Header>` +
    `<nfeCabecMsg xmlns="${DIST_WSDL_NS}">` +
    `<cUF>${args.ufCode}</cUF>` +
    `<versaoDados>1.01</versaoDados>` +
    `</nfeCabecMsg>` +
    `</soap12:Header>` +
    `<soap12:Body>` +
    `<nfeDistDFeInteresse xmlns="${DIST_WSDL_NS}">` +
    `<nfeDadosMsg>${args.bodyXml}</nfeDadosMsg>` +
    `</nfeDistDFeInteresse>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

function normalizeDocSchema(rawSchema: string): string {
  const cleaned = rawSchema.trim().replace(/\.xsd$/i, "");
  const [base] = cleaned.split("_");
  return (base || cleaned).trim();
}

function mapManifestAccepted(eventCStat: string): boolean {
  return eventCStat === "135" || eventCStat === "136" || eventCStat === "573";
}

function extractDocZipEntries(retDist: Record<string, unknown>): z.infer<typeof DistDocZipSchema>[] {
  const lote = asRecord(retDist.loteDistDFeInt);
  if (!lote) return [];

  const rawDocZip = lote.docZip;
  const asArray = Array.isArray(rawDocZip) ? rawDocZip : rawDocZip ? [rawDocZip] : [];

  const parsed: z.infer<typeof DistDocZipSchema>[] = [];
  for (const item of asArray) {
    if (typeof item === "string") {
      continue;
    }

    const record = asRecord(item);
    if (!record) continue;

    const nsu = toStringValue(record["@_NSU"]);
    const schema = toStringValue(record["@_schema"]);
    const xmlBase64 =
      toStringValue(record["#text"]) ||
      toStringValue(record.__text) ||
      toStringValue(record.value);

    if (!nsu || !schema || !xmlBase64) continue;

    const validated = DistDocZipSchema.safeParse({
      nsu: normalizeNsu(nsu),
      schema,
      xmlBase64,
    });
    if (validated.success) {
      parsed.push(validated.data);
    }
  }

  return parsed;
}

type ParsedDistResponse = {
  cStat: string;
  xMotivo: string;
  ultNsu: string;
  maxNsu: string;
  docs: z.infer<typeof DistDocZipSchema>[];
};

function parseDistResponse(xml: string): ParsedDistResponse {
  const parsed = parser.parse(xml);
  const envelope =
    asRecord(parsed)?.Envelope ||
    asRecord(parsed)?.soap12Envelope ||
    asRecord(parsed)?.["soap:Envelope"] ||
    asRecord(parsed);

  const body = asRecord(getPath(envelope, ["Body"])) || asRecord(getPath(envelope, ["soap:Body"])) || envelope;
  const responseNode =
    getPath(body, ["nfeDistDFeInteresseResponse", "nfeDistDFeInteresseResult"]) ||
    getPath(body, ["nfeDistDFeInteresseResult"]) ||
    getPath(body, ["nfeResultMsg"]) ||
    body;

  let retDist: Record<string, unknown> | null = null;

  const responseAsString = toStringValue(responseNode);
  if (responseAsString && responseAsString.includes("retDistDFeInt")) {
    const innerParsed = parser.parse(responseAsString);
    retDist = asRecord(asRecord(innerParsed)?.retDistDFeInt) || asRecord(innerParsed);
  }

  if (!retDist) {
    const responseRecord = asRecord(responseNode);
    retDist =
      asRecord(getPath(responseRecord, ["retDistDFeInt"])) ||
      responseRecord;
  }

  if (!retDist) {
    throw new Error("Resposta da distribuição DF-e inválida: retDistDFeInt ausente.");
  }

  const cStat = normalizeNsu(toStringValue(retDist.cStat));
  const xMotivo = toStringValue(retDist.xMotivo) || "Sem motivo informado";
  const ultNsu = normalizeNsu(toStringValue(retDist.ultNSU));
  const maxNsu = normalizeNsu(toStringValue(retDist.maxNSU));
  const docs = extractDocZipEntries(retDist);

  return { cStat, xMotivo, ultNsu, maxNsu, docs };
}

type ParsedManifestResponse = {
  envelopeCStat: string;
  envelopeXMotivo: string;
  eventCStat: string;
  eventXMotivo: string;
  protocol: string | null;
  receipt: string | null;
};

function parseManifestResponse(xml: string): ParsedManifestResponse {
  const parsed = parser.parse(xml);
  const envelope =
    asRecord(parsed)?.Envelope ||
    asRecord(parsed)?.soap12Envelope ||
    asRecord(parsed)?.["soap:Envelope"] ||
    asRecord(parsed);
  const body = asRecord(getPath(envelope, ["Body"])) || asRecord(getPath(envelope, ["soap:Body"])) || envelope;
  const retEnvEvento = asRecord(getPath(body, ["nfeResultMsg", "retEnvEvento"])) || asRecord(getPath(body, ["retEnvEvento"]));

  if (!retEnvEvento) {
    throw new Error("Resposta de manifestação inválida: retEnvEvento ausente.");
  }

  const envelopeCStat = normalizeNsu(toStringValue(retEnvEvento.cStat));
  const envelopeXMotivo = toStringValue(retEnvEvento.xMotivo) || "Sem motivo informado";
  const receipt = toStringValue(retEnvEvento.nRec);

  const rawRetEvento = retEnvEvento.retEvento;
  const retEvento = Array.isArray(rawRetEvento) ? asRecord(rawRetEvento[0]) : asRecord(rawRetEvento);
  const infEvento = asRecord(retEvento?.infEvento);

  const eventCStat = normalizeNsu(toStringValue(infEvento?.cStat) || envelopeCStat);
  const eventXMotivo = toStringValue(infEvento?.xMotivo) || envelopeXMotivo;
  const protocol = toStringValue(infEvento?.nProt);

  return {
    envelopeCStat,
    envelopeXMotivo,
    eventCStat,
    eventXMotivo,
    protocol,
    receipt,
  };
}

async function resolveCompanyIdentity(companyId: string): Promise<{ cnpj: string; uf: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_settings")
    .select("cnpj,address_state")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao ler company_settings para DF-e: ${error.message}`);
  }

  const parsed = CompanySettingsIdentityRowSchema.safeParse(data ?? {});
  if (!parsed.success) {
    throw new Error("Configuração fiscal da empresa inválida para DF-e.");
  }

  const cnpj = toDigits(parsed.data.cnpj);
  if (cnpj.length !== 14) {
    throw new Error("CNPJ da empresa inválido para Distribuição DF-e.");
  }

  const uf = String(parsed.data.address_state ?? "").trim().toUpperCase();
  if (!UF_TO_CODE[uf]) {
    throw new Error("UF da empresa não configurada para integração DF-e.");
  }

  return { cnpj, uf };
}

class StubDfeProvider implements DfeProvider {
  private readonly docs: NormalizedDfeDoc[];

  constructor(docs: NormalizedDfeDoc[]) {
    this.docs = docs.sort((a, b) => compareNsu(a.nsu, b.nsu));
  }

  async fetchByNsu(args: {
    companyId: string;
    environment: DfeEnvironment;
    lastNsu: string;
    jobId?: string;
  }): Promise<DistProviderFetchResult> {
    const pending = this.docs.filter((doc) => compareNsu(doc.nsu, args.lastNsu) > 0);
    const batch = pending.slice(0, 50);
    const maxNsu = batch.length > 0 ? batch[batch.length - 1].nsu : args.lastNsu;

    logger.info("[NFE_DFE_DIST_SYNC] Stub provider fetchByNsu", {
      companyId: args.companyId,
      environment: args.environment,
      requestedAfter: args.lastNsu,
      returned: batch.length,
      maxNsu,
    });

    return DistProviderFetchResultSchema.parse({
      maxNsu,
      docs: batch,
      hasMore: pending.length > batch.length,
    });
  }

  async sendManifest(args: {
    companyId: string;
    environment: DfeEnvironment;
    chNFe: string;
    eventType: ManifestEventType;
    justification?: string | null;
    jobId?: string;
  }): Promise<ManifestProviderResult> {
    logger.info("[NFE_DFE_MANIFEST_SEND] Stub provider sendManifest", {
      companyId: args.companyId,
      environment: args.environment,
      chNFe: args.chNFe,
      eventType: args.eventType,
    });

    const protocol = `STUB-${args.eventType}-${Date.now()}`;
    const receipt = `REC-${args.chNFe.slice(-10)}`;

    return ManifestProviderResultSchema.parse({ protocol, receipt });
  }
}

class RealDfeProvider implements DfeProvider {
  async fetchByNsu(args: {
    companyId: string;
    environment: DfeEnvironment;
    lastNsu: string;
    jobId?: string;
  }): Promise<DistProviderFetchResult> {
    const cert = await loadCompanyCertificate(args.companyId);
    const identity = await resolveCompanyIdentity(args.companyId);
    const tpAmb = toTpAmb(args.environment);
    const cUFAutor = UF_TO_CODE[identity.uf];
    const requestedNsu = padNsu15(args.lastNsu);
    const singleShotMode = String(process.env.NFE_DFE_DIST_SINGLE_SHOT ?? "").toLowerCase() === "true";
    const caller = "lib/fiscal/inbound/provider.ts:RealDfeProvider.fetchByNsu";
    const callTimestamp = new Date().toISOString();

    const xmlBody =
      `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<cUFAutor>${cUFAutor}</cUFAutor>` +
      `<CNPJ>${identity.cnpj}</CNPJ>` +
      `<distNSU><ultNSU>${requestedNsu}</ultNSU></distNSU>` +
      `</distDFeInt>`;

    const envelope = buildDistSoapEnvelope({
      ufCode: cUFAutor,
      bodyXml: xmlBody,
    });
    const endpoint = DIST_ENDPOINTS[args.environment];

    logger.info("[NFE_DFE_DIST_SYNC] Dist request prepared", {
      jobId: args.jobId ?? null,
      company_id: args.companyId,
      environment: args.environment,
      cnpj: identity.cnpj,
      ult_nsu_enviado: requestedNsu,
      endpoint,
      timestamp: callTimestamp,
      caller,
      single_shot_mode: singleShotMode,
    });

    if (singleShotMode) {
      logger.info("[NFE_DFE_DIST_SYNC] Dist SOAP XML request", {
        jobId: args.jobId ?? null,
        company_id: args.companyId,
        environment: args.environment,
        caller,
        single_shot_mode: true,
        soap_request_xml: envelope,
      });
    }

    const { body, status } = await soapRequest(endpoint, DIST_SOAP_ACTION, envelope, cert, {
      debug: singleShotMode || process.env.SEFAZ_DEBUG === "true" || process.env.NFE_WS_DEBUG === "1",
      debugDir: process.env.SEFAZ_DEBUG_DIR,
      context: {
        jobId: args.jobId,
        companyId: args.companyId,
        environment: args.environment,
      },
    });

    if (singleShotMode) {
      logger.info("[NFE_DFE_DIST_SYNC] Dist SOAP XML response", {
        jobId: args.jobId ?? null,
        company_id: args.companyId,
        environment: args.environment,
        caller,
        single_shot_mode: true,
        http_status: status,
        soap_response_xml: body,
      });
    }

    if (status !== 200) {
      throw new Error(`Distribuição DF-e retornou HTTP ${status}.`);
    }

    const parsed = parseDistResponse(body);
    logger.info("[NFE_DFE_DIST_SYNC] Dist response parsed", {
      jobId: args.jobId ?? null,
      company_id: args.companyId,
      environment: args.environment,
      cnpj: identity.cnpj,
      ult_nsu_enviado: requestedNsu,
      http_status: status,
      c_stat: parsed.cStat,
      x_motivo: parsed.xMotivo,
      ult_nsu_retornado: parsed.ultNsu,
      max_nsu_retornado: parsed.maxNsu,
      docs_retornados: parsed.docs.length,
      timestamp: new Date().toISOString(),
      caller,
      single_shot_mode: singleShotMode,
    });

    if (parsed.cStat !== "137" && parsed.cStat !== "138") {
      throw new Error(`SEFAZ distribuição rejeitou: [${parsed.cStat}] ${parsed.xMotivo}`);
    }

    const docs = parsed.docs.map((doc) =>
      normalizeDistributionDoc({
        nsu: normalizeNsu(doc.nsu),
        schema: normalizeDocSchema(doc.schema),
        xmlBase64: doc.xmlBase64,
        xmlIsGz: true,
        summaryJson: {
          source: "SEFAZ_DISTRIBUICAO",
          rawSchema: doc.schema,
          cStat: parsed.cStat,
          xMotivo: parsed.xMotivo,
        },
      }),
    );

    const hasMore = compareNsu(parsed.ultNsu, parsed.maxNsu) < 0;

    logger.info("[NFE_DFE_DIST_SYNC] Real provider fetchByNsu", {
      jobId: args.jobId ?? null,
      companyId: args.companyId,
      environment: args.environment,
      cnpj: identity.cnpj,
      requestedAfter: requestedNsu,
      returned: docs.length,
      ultNsu: parsed.ultNsu,
      maxNsu: parsed.maxNsu,
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      httpStatus: status,
      hasMore,
      caller,
      single_shot_mode: singleShotMode,
    });

    return DistProviderFetchResultSchema.parse({
      maxNsu: parsed.ultNsu,
      docs,
      hasMore,
    });
  }

  async sendManifest(args: {
    companyId: string;
    environment: DfeEnvironment;
    chNFe: string;
    eventType: ManifestEventType;
    justification?: string | null;
    jobId?: string;
  }): Promise<ManifestProviderResult> {
    const cert = await loadCompanyCertificate(args.companyId);
    const identity = await resolveCompanyIdentity(args.companyId);
    const tpAmb = toTpAmb(args.environment);
    const config = MANIFEST_EVENT_CONFIG[args.eventType];

    if (!config) {
      throw new Error(`Tipo de manifestação inválido: ${args.eventType}`);
    }

    const justification = String(args.justification ?? "").trim();
    if (config.requiresJustification && justification.length < 15) {
      throw new Error("Justificativa deve conter ao menos 15 caracteres para Operação não realizada.");
    }

    const eventId = `ID${config.code}${args.chNFe}01`;
    const eventTimestamp = formatDateTimeInBrasilia(new Date());
    const detJustification =
      config.requiresJustification ? `<xJust>${escapeXml(justification)}</xJust>` : "";

    const unsignedEventXml =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<idLote>${Date.now().toString().slice(-15)}</idLote>` +
      `<evento versao="1.00">` +
      `<infEvento Id="${eventId}">` +
      `<cOrgao>91</cOrgao>` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<CNPJ>${identity.cnpj}</CNPJ>` +
      `<chNFe>${args.chNFe}</chNFe>` +
      `<dhEvento>${eventTimestamp}</dhEvento>` +
      `<tpEvento>${config.code}</tpEvento>` +
      `<nSeqEvento>1</nSeqEvento>` +
      `<verEvento>1.00</verEvento>` +
      `<detEvento versao="1.00">` +
      `<descEvento>${config.description}</descEvento>` +
      `${detJustification}` +
      `</detEvento>` +
      `</infEvento>` +
      `</evento>` +
      `</envEvento>`;

    const { signedXml } = signEventXml(unsignedEventXml, {
      pfxBase64: cert.pfxBase64,
      pfxPassword: cert.pfxPassword,
    });

    const envelope = buildSoapEnvelope(
      sanitizeSignedEventXmlForSoap(signedXml),
      identity.uf,
      "NFeRecepcaoEvento4",
    );
    const endpoint = getSefazUrl(identity.uf, tpAmb, "NFeRecepcaoEvento4");

    const { body, status } = await soapRequest(endpoint, EVENT_SOAP_ACTION, envelope, cert, {
      debug: process.env.SEFAZ_DEBUG === "true" || process.env.NFE_WS_DEBUG === "1",
      debugDir: process.env.SEFAZ_DEBUG_DIR,
      context: {
        jobId: args.jobId,
        companyId: args.companyId,
        environment: args.environment,
      },
    });

    if (status !== 200) {
      throw new Error(`Manifestação retornou HTTP ${status}.`);
    }

    const parsed = parseManifestResponse(body);
    const accepted = parsed.envelopeCStat === "128" && mapManifestAccepted(parsed.eventCStat);
    if (!accepted) {
      throw new Error(`SEFAZ rejeitou manifestação: [${parsed.eventCStat}] ${parsed.eventXMotivo}`);
    }

    logger.info("[NFE_DFE_MANIFEST_SEND] Real provider sendManifest", {
      companyId: args.companyId,
      environment: args.environment,
      chNFe: args.chNFe,
      eventType: args.eventType,
      cStat: parsed.eventCStat,
    });

    return ManifestProviderResultSchema.parse({
      protocol: parsed.protocol,
      receipt: parsed.receipt,
    });
  }
}

function parseStubDocsFromEnv(): NormalizedDfeDoc[] {
  const raw = process.env.NFE_DFE_STUB_DOCS_JSON;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    const docs = z.array(StubDocConfigSchema).parse(parsed);
    return docs.map((doc) =>
      normalizeDistributionDoc({
        nsu: doc.nsu,
        schema: doc.schema,
        xmlBase64: doc.xmlBase64,
        xmlIsGz: doc.xmlIsGz,
        summaryJson: doc.summaryJson,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("[NFE_DFE_DIST_SYNC] Invalid NFE_DFE_STUB_DOCS_JSON; fallback to empty stub", { message });
    return [];
  }
}

export function createDfeProvider(): DfeProvider {
  const mode = (process.env.NFE_DFE_PROVIDER || "auto").toLowerCase();

  if (mode === "stub") {
    const docs = parseStubDocsFromEnv();
    logger.warn("[NFE_DFE_DIST_SYNC] Provider DF-e em modo STUB", { docsConfigured: docs.length });
    return new StubDfeProvider(docs);
  }

  if (mode !== "auto" && mode !== "real") {
    logger.warn("[NFE_DFE_DIST_SYNC] Modo de provider desconhecido, usando real", { requestedMode: mode });
  }

  return new RealDfeProvider();
}
