import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabaseServer";
import { DfeEnvironmentSchema } from "@/lib/fiscal/inbound/schemas";
import { listInboundManifestEvents, resolveEnvironmentForCompany } from "@/lib/fiscal/inbound/service";

export const runtime = "nodejs";

function toInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const context = await resolveCompanyContext();
    const admin = createAdminClient();
    const params = req.nextUrl.searchParams;

    const environmentFromQuery = params.get("environment");
    const environment = environmentFromQuery
      ? DfeEnvironmentSchema.parse(environmentFromQuery)
      : await resolveEnvironmentForCompany(admin, context.companyId);

    const page = toInt(params.get("page")) ?? 1;
    const pageSize = toInt(params.get("pageSize")) ?? 30;

    const { rows, total } = await listInboundManifestEvents(admin, {
      companyId: context.companyId,
      environment,
      page,
      pageSize,
    });

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar eventos";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
