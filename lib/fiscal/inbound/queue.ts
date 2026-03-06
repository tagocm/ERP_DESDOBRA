import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  DfeEnvironment,
  DfeManifestJobPayloadSchema,
  DfeSyncJobPayload,
  DfeSyncJobPayloadSchema,
  ManifestEventType,
} from "@/lib/fiscal/inbound/schemas";

const QueueRowSchema = z.object({
  id: z.string().uuid(),
  payload: z.unknown(),
  status: z.string(),
});

type QueueClient = SupabaseClient;

function isSameSyncPayload(payload: unknown, companyId: string, environment: DfeEnvironment): boolean {
  const parsed = DfeSyncJobPayloadSchema.safeParse(payload);
  return parsed.success && parsed.data.companyId === companyId && parsed.data.environment === environment;
}

function isSameManifestPayload(payload: unknown, args: {
  companyId: string;
  environment: DfeEnvironment;
  chnfe?: string;
  eventType?: ManifestEventType;
  eventId?: string;
}): boolean {
  const parsed = DfeManifestJobPayloadSchema.safeParse(payload);
  if (!parsed.success) return false;

  if (parsed.data.companyId !== args.companyId) return false;
  if (parsed.data.environment !== args.environment) return false;
  if (args.eventId && parsed.data.eventId !== args.eventId) return false;
  if (args.chnfe && parsed.data.chnfe !== args.chnfe) return false;
  if (args.eventType && parsed.data.eventType !== args.eventType) return false;
  return true;
}

export async function enqueueDfeDistSyncJob(
  admin: QueueClient,
  payload: DfeSyncJobPayload,
): Promise<{ jobId: string; created: boolean }> {
  const normalized = DfeSyncJobPayloadSchema.parse(payload);

  const { data: existingRows, error: existingError } = await admin
    .from("jobs_queue")
    .select("id,payload,status")
    .eq("job_type", "NFE_DFE_DIST_SYNC")
    .in("status", ["pending", "processing"])
    .limit(200);

  if (existingError) {
    throw new Error(`Falha ao verificar fila de sincronização DF-e: ${existingError.message}`);
  }

  const existing = (existingRows ?? [])
    .map((row) => QueueRowSchema.safeParse(row))
    .filter((row): row is { success: true; data: z.infer<typeof QueueRowSchema> } => row.success)
    .find((row) => isSameSyncPayload(row.data.payload, normalized.companyId, normalized.environment));

  if (existing) {
    return { jobId: existing.data.id, created: false };
  }

  const { data: inserted, error: insertError } = await admin
    .from("jobs_queue")
    .insert({
      job_type: "NFE_DFE_DIST_SYNC",
      payload: normalized,
      status: "pending",
      max_attempts: 1,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message || "Falha ao enfileirar sincronização DF-e.");
  }

  return { jobId: inserted.id, created: true };
}

export async function enqueueDfeManifestSendJob(
  admin: QueueClient,
  args: {
    companyId: string;
    environment: DfeEnvironment;
    chnfe?: string;
    eventType?: ManifestEventType;
    eventId?: string;
  },
): Promise<{ jobId: string; created: boolean }> {
  const payload = DfeManifestJobPayloadSchema.parse(args);

  const { data: existingRows, error: existingError } = await admin
    .from("jobs_queue")
    .select("id,payload,status")
    .eq("job_type", "NFE_DFE_MANIFEST_SEND")
    .in("status", ["pending", "processing"])
    .limit(200);

  if (existingError) {
    throw new Error(`Falha ao verificar fila de manifestação DF-e: ${existingError.message}`);
  }

  const existing = (existingRows ?? [])
    .map((row) => QueueRowSchema.safeParse(row))
    .filter((row): row is { success: true; data: z.infer<typeof QueueRowSchema> } => row.success)
    .find((row) =>
      isSameManifestPayload(row.data.payload, {
        companyId: payload.companyId,
        environment: payload.environment,
        chnfe: payload.chnfe,
        eventType: payload.eventType,
        eventId: payload.eventId,
      }),
    );

  if (existing) {
    return { jobId: existing.data.id, created: false };
  }

  const { data: inserted, error: insertError } = await admin
    .from("jobs_queue")
    .insert({
      job_type: "NFE_DFE_MANIFEST_SEND",
      payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message || "Falha ao enfileirar envio de manifestação.");
  }

  return { jobId: inserted.id, created: true };
}
