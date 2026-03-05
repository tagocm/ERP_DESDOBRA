import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { createAdminClient } from "@/lib/supabaseServer";
import { InboundListFiltersSchema } from "@/lib/fiscal/inbound/schemas";
import { listInboundDfe, resolveEnvironmentForCompany } from "@/lib/fiscal/inbound/service";

export const runtime = "nodejs";

function toBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

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

    const defaultEnvironment = await resolveEnvironmentForCompany(admin, context.companyId);

    const filters = InboundListFiltersSchema.parse({
      environment: params.get("environment") ?? defaultEnvironment,
      tab: params.get("tab") ?? undefined,
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
      emitter: params.get("emitter") ?? undefined,
      chnfe: params.get("chnfe") ?? undefined,
      manifestStatus: params.get("manifestStatus") ?? undefined,
      onlyFullXml: toBoolean(params.get("onlyFullXml")),
      page: toInt(params.get("page")) ?? 1,
      pageSize: toInt(params.get("pageSize")) ?? 50,
    });

    const { rows, total } = await listInboundDfe(admin, {
      companyId: context.companyId,
      filters,
    });

    return NextResponse.json({
      data: rows,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar NF-e de entrada";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
