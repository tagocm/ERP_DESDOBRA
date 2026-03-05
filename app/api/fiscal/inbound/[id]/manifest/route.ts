import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabaseServer";
import {
  DfeEnvironmentSchema,
  ManifestEventTypeSchema,
} from "@/lib/fiscal/inbound/schemas";
import { getInboundDfeById } from "@/lib/fiscal/inbound/service";
import { enqueueDfeManifestSendJob } from "@/lib/fiscal/inbound/queue";

export const runtime = "nodejs";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const BodySchema = z
  .object({
    environment: DfeEnvironmentSchema.optional(),
    eventType: ManifestEventTypeSchema,
    justification: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (["DESCONHECIMENTO", "NAO_REALIZADA"].includes(value.eventType)) {
      const length = value.justification?.trim().length ?? 0;
      if (length < 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Justificativa obrigatória com no mínimo 15 caracteres.",
          path: ["justification"],
        });
      }
    }
  });

const EnqueuedEventSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  environment: DfeEnvironmentSchema,
  chnfe: z.string().regex(/^\d{44}$/),
  event_type: ManifestEventTypeSchema,
  status: z.enum(["PENDING", "SENT", "ERROR"]),
  justification: z.string().nullable().optional(),
});

function parseRpcSingle<T>(payload: unknown, schema: z.ZodType<T>): T {
  if (Array.isArray(payload)) {
    if (payload.length === 0) throw new Error("RPC retornou array vazio");
    return schema.parse(payload[0]);
  }
  return schema.parse(payload);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const params = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await req.json());

    const companyCtx = await resolveCompanyContext();
    const admin = createAdminClient();

    const inbound = await getInboundDfeById(admin, {
      companyId: companyCtx.companyId,
      id: params.id,
    });

    if (!inbound) {
      return NextResponse.json({ error: "NF-e de entrada não encontrada" }, { status: 404 });
    }

    if (!inbound.chnfe) {
      return NextResponse.json(
        { error: "Esta NF-e não possui chave disponível para manifestação." },
        { status: 409 },
      );
    }

    const environment = body.environment ?? inbound.environment;

    const { data: enqueueData, error: enqueueError } = await admin.rpc("enqueue_manifest_event", {
      p_company_id: companyCtx.companyId,
      p_environment: environment,
      p_chnfe: inbound.chnfe,
      p_event_type: body.eventType,
      p_justification: body.justification ?? null,
    });

    if (enqueueError) {
      return NextResponse.json({ error: enqueueError.message }, { status: 400 });
    }

    const event = parseRpcSingle(enqueueData, EnqueuedEventSchema);

    const job = await enqueueDfeManifestSendJob(admin, {
      companyId: companyCtx.companyId,
      environment,
      eventId: event.id,
      chnfe: event.chnfe,
      eventType: event.event_type,
    });

    return NextResponse.json({
      success: true,
      event,
      job,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enfileirar manifestação";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
