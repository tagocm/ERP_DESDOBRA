import { z } from "zod";

export const DfeEnvironmentSchema = z.enum(["production", "homologation"]);
export type DfeEnvironment = z.infer<typeof DfeEnvironmentSchema>;

export const ManifestEventTypeSchema = z.enum([
  "CIENCIA",
  "CONFIRMACAO",
  "DESCONHECIMENTO",
  "NAO_REALIZADA",
]);
export type ManifestEventType = z.infer<typeof ManifestEventTypeSchema>;

export const ManifestStatusSchema = z.enum([
  "SEM_MANIFESTACAO",
  "CIENCIA",
  "CONFIRMADA",
  "DESCONHECIDA",
  "NAO_REALIZADA",
]);
export type ManifestStatus = z.infer<typeof ManifestStatusSchema>;

export const NormalizedDfeDocSchema = z.object({
  nsu: z.string().regex(/^\d+$/),
  schema: z.string().min(1),
  chnfe: z.string().regex(/^\d{44}$/).nullable().optional(),
  emitCnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
  emitNome: z.string().min(1).nullable().optional(),
  destCnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
  dhEmi: z.string().datetime({ offset: true }).nullable().optional(),
  total: z.number().nonnegative().nullable().optional(),
  summaryJson: z.record(z.string(), z.unknown()).default({}),
  xmlBase64: z.string().nullable().optional(),
  xmlIsGz: z.boolean().default(false),
  hasFullXml: z.boolean().default(false),
  manifestStatus: ManifestStatusSchema.default("SEM_MANIFESTACAO"),
  manifestUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
});
export type NormalizedDfeDoc = z.infer<typeof NormalizedDfeDocSchema>;

export const DfeSyncJobPayloadSchema = z.object({
  companyId: z.string().uuid(),
  environment: DfeEnvironmentSchema,
  source: z.enum(["scheduler", "manual", "retry"]).default("scheduler"),
  requestedBy: z.string().uuid().nullable().optional(),
});
export type DfeSyncJobPayload = z.infer<typeof DfeSyncJobPayloadSchema>;

export const DfeManifestJobPayloadSchema = z.object({
  companyId: z.string().uuid(),
  environment: DfeEnvironmentSchema,
  chnfe: z.string().regex(/^\d{44}$/).optional(),
  eventType: ManifestEventTypeSchema.optional(),
  eventId: z.string().uuid().optional(),
});
export type DfeManifestJobPayload = z.infer<typeof DfeManifestJobPayloadSchema>;

export const DistProviderFetchResultSchema = z.object({
  maxNsu: z.string().regex(/^\d+$/),
  docs: z.array(NormalizedDfeDocSchema),
  hasMore: z.boolean(),
});
export type DistProviderFetchResult = z.infer<typeof DistProviderFetchResultSchema>;

export const ManifestProviderResultSchema = z.object({
  protocol: z.string().nullable().optional(),
  receipt: z.string().nullable().optional(),
});
export type ManifestProviderResult = z.infer<typeof ManifestProviderResultSchema>;

export const InboundListFiltersSchema = z.object({
  environment: DfeEnvironmentSchema.optional(),
  tab: z.enum(["pending", "received", "cancelled", "processing"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  emitter: z.string().trim().min(1).optional(),
  chnfe: z.string().trim().min(1).optional(),
  manifestStatus: ManifestStatusSchema.optional(),
  onlyFullXml: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(200).default(50),
});
export type InboundListFilters = z.infer<typeof InboundListFiltersSchema>;
