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
import { z } from "zod";

export interface DfeProvider {
  fetchByNsu(args: {
    companyId: string;
    environment: DfeEnvironment;
    lastNsu: string;
  }): Promise<DistProviderFetchResult>;
  sendManifest(args: {
    companyId: string;
    environment: DfeEnvironment;
    chNFe: string;
    eventType: ManifestEventType;
    justification?: string | null;
  }): Promise<ManifestProviderResult>;
}

const StubDocConfigSchema = z.object({
  nsu: z.string().regex(/^\d+$/),
  schema: z.string().min(1),
  xmlBase64: z.string().min(1).optional(),
  xmlIsGz: z.boolean().default(false),
  summaryJson: z.record(z.string(), z.unknown()).optional(),
});

class StubDfeProvider implements DfeProvider {
  private readonly docs: NormalizedDfeDoc[];

  constructor(docs: NormalizedDfeDoc[]) {
    this.docs = docs.sort((a, b) => Number(a.nsu) - Number(b.nsu));
  }

  async fetchByNsu(args: {
    companyId: string;
    environment: DfeEnvironment;
    lastNsu: string;
  }): Promise<DistProviderFetchResult> {
    const last = Number(args.lastNsu);
    const pending = this.docs.filter((doc) => Number(doc.nsu) > last);
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
  const mode = (process.env.NFE_DFE_PROVIDER || "stub").toLowerCase();
  if (mode !== "stub") {
    logger.warn("[NFE_DFE_DIST_SYNC] Provider real ainda não configurado; usando stub", { requestedMode: mode });
  }

  const docs = parseStubDocsFromEnv();
  return new StubDfeProvider(docs);
}
