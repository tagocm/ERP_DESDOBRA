import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabaseServer";
import { DfeEnvironmentSchema } from "@/lib/fiscal/inbound/schemas";
import { resolveEnvironmentForCompany } from "@/lib/fiscal/inbound/service";
import { enqueueDfeDistSyncJob } from "@/lib/fiscal/inbound/queue";

export const runtime = "nodejs";

const BodySchema = z.object({
  environment: DfeEnvironmentSchema.optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const context = await resolveCompanyContext();
    const bodyUnknown: unknown = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyUnknown);

    const admin = createAdminClient();
    const environment =
      body.environment ?? (await resolveEnvironmentForCompany(admin, context.companyId));

    const enqueue = await enqueueDfeDistSyncJob(admin, {
      companyId: context.companyId,
      environment,
      source: "manual",
      requestedBy: context.userId,
    });

    return NextResponse.json({
      success: true,
      jobId: enqueue.jobId,
      created: enqueue.created,
      environment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enfileirar sincronização";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
