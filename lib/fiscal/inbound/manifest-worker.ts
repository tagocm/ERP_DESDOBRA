import { createAdminClient } from "@/lib/supabaseServer";
import { createDfeProvider } from "@/lib/fiscal/inbound/provider";
import {
  DfeManifestJobPayloadSchema,
  ManifestEventType,
  ManifestProviderResultSchema,
} from "@/lib/fiscal/inbound/schemas";
import { logger } from "@/lib/logger";
import { z } from "zod";

const ManifestEventRowSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  environment: z.enum(["production", "homologation"]),
  chnfe: z.string().regex(/^\d{44}$/),
  event_type: z.enum(["CIENCIA", "CONFIRMACAO", "DESCONHECIMENTO", "NAO_REALIZADA"]),
  justification: z.string().nullable(),
  status: z.enum(["PENDING", "SENT", "ERROR"]),
});

function mapEventToManifestStatus(eventType: ManifestEventType):
  | "CIENCIA"
  | "CONFIRMADA"
  | "DESCONHECIDA"
  | "NAO_REALIZADA" {
  switch (eventType) {
    case "CIENCIA":
      return "CIENCIA";
    case "CONFIRMACAO":
      return "CONFIRMADA";
    case "DESCONHECIMENTO":
      return "DESCONHECIDA";
    case "NAO_REALIZADA":
      return "NAO_REALIZADA";
  }
}

export async function processDfeManifestSendJob(payload: unknown, jobId: string): Promise<void> {
  const parsedPayload = DfeManifestJobPayloadSchema.parse(payload);
  const admin = createAdminClient();
  const provider = createDfeProvider();

  logger.info("[NFE_DFE_MANIFEST_SEND] Iniciando processamento", {
    jobId,
    companyId: parsedPayload.companyId,
    environment: parsedPayload.environment,
    eventId: parsedPayload.eventId,
    chnfe: parsedPayload.chnfe,
    eventType: parsedPayload.eventType,
  });

  let query = admin
    .from("fiscal_inbound_manifest_events")
    .select("id,company_id,environment,chnfe,event_type,justification,status")
    .eq("company_id", parsedPayload.companyId)
    .eq("environment", parsedPayload.environment)
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(20);

  if (parsedPayload.eventId) {
    query = query.eq("id", parsedPayload.eventId);
  }
  if (parsedPayload.chnfe) {
    query = query.eq("chnfe", parsedPayload.chnfe);
  }
  if (parsedPayload.eventType) {
    query = query.eq("event_type", parsedPayload.eventType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao buscar eventos pendentes de manifestação: ${error.message}`);
  }

  const events = z.array(ManifestEventRowSchema).parse(data ?? []);

  if (events.length === 0) {
    logger.info("[NFE_DFE_MANIFEST_SEND] Nenhum evento pendente", {
      jobId,
      companyId: parsedPayload.companyId,
      environment: parsedPayload.environment,
    });
    return;
  }

  for (const event of events) {
    try {
      const result = ManifestProviderResultSchema.parse(
        await provider.sendManifest({
          companyId: event.company_id,
          environment: event.environment,
          chNFe: event.chnfe,
          eventType: event.event_type,
          justification: event.justification,
        }),
      );

      const nowIso = new Date().toISOString();

      const { error: updateEventError } = await admin
        .from("fiscal_inbound_manifest_events")
        .update({
          status: "SENT",
          sefaz_receipt: result.receipt ?? null,
          sefaz_protocol: result.protocol ?? null,
          last_error: null,
          updated_at: nowIso,
        })
        .eq("id", event.id)
        .eq("company_id", event.company_id);

      if (updateEventError) {
        throw new Error(`Falha ao atualizar evento de manifestação: ${updateEventError.message}`);
      }

      const manifestStatus = mapEventToManifestStatus(event.event_type);
      const { error: updateInboundError } = await admin
        .from("fiscal_inbound_dfe")
        .update({
          manifest_status: manifestStatus,
          manifest_updated_at: nowIso,
          updated_at: nowIso,
        })
        .eq("company_id", event.company_id)
        .eq("environment", event.environment)
        .eq("chnfe", event.chnfe);

      if (updateInboundError) {
        throw new Error(`Falha ao atualizar status de manifestação na NF-e de entrada: ${updateInboundError.message}`);
      }

      logger.info("[NFE_DFE_MANIFEST_SEND] Evento enviado", {
        jobId,
        eventId: event.id,
        chnfe: event.chnfe,
        eventType: event.event_type,
        protocol: result.protocol,
      });
    } catch (errorEvent) {
      const message = errorEvent instanceof Error ? errorEvent.message : String(errorEvent);

      await admin
        .from("fiscal_inbound_manifest_events")
        .update({
          status: "ERROR",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id)
        .eq("company_id", event.company_id);

      logger.error("[NFE_DFE_MANIFEST_SEND] Falha ao enviar evento", {
        jobId,
        eventId: event.id,
        chnfe: event.chnfe,
        eventType: event.event_type,
        error: message,
      });

      throw errorEvent;
    }
  }
}
