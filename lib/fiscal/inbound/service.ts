import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  DfeEnvironment,
  DfeEnvironmentSchema,
  InboundListFilters,
  ManifestStatusSchema,
} from "@/lib/fiscal/inbound/schemas";

const InboundDocRowSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  environment: DfeEnvironmentSchema,
  nsu: z.string(),
  schema: z.string(),
  chnfe: z.string().nullable(),
  emit_cnpj: z.string().nullable(),
  emit_nome: z.string().nullable(),
  dest_cnpj: z.string().nullable(),
  dh_emi: z.string().nullable(),
  total: z.number().nullable(),
  summary_json: z.record(z.string(), z.unknown()),
  has_full_xml: z.boolean(),
  manifest_status: ManifestStatusSchema,
  manifest_updated_at: z.string().nullable(),
  created_at: z.string(),
});

const ManifestEventRowSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  environment: DfeEnvironmentSchema,
  chnfe: z.string().regex(/^\d{44}$/),
  event_type: z.enum(["CIENCIA", "CONFIRMACAO", "DESCONHECIMENTO", "NAO_REALIZADA"]),
  justification: z.string().nullable(),
  status: z.enum(["PENDING", "SENT", "ERROR"]),
  sefaz_receipt: z.string().nullable(),
  sefaz_protocol: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const CompanySettingsSchema = z.object({
  nfe_environment: DfeEnvironmentSchema.nullable(),
});

type AdminClient = SupabaseClient;

export type InboundDocRow = z.infer<typeof InboundDocRowSchema>;
export type InboundManifestEventRow = z.infer<typeof ManifestEventRowSchema>;

function normalizeEmitterSearch(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeChnfeSearch(value?: string): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export async function resolveEnvironmentForCompany(admin: AdminClient, companyId: string): Promise<DfeEnvironment> {
  const { data, error } = await admin
    .from("company_settings")
    .select("nfe_environment")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao resolver ambiente fiscal: ${error.message}`);
  }

  const parsed = CompanySettingsSchema.safeParse(data);
  if (!parsed.success || !parsed.data.nfe_environment) {
    return "homologation";
  }

  return parsed.data.nfe_environment;
}

export async function listInboundDfe(
  admin: AdminClient,
  args: {
    companyId: string;
    filters: InboundListFilters;
  },
): Promise<{ rows: InboundDocRow[]; total: number }> {
  const { companyId, filters } = args;
  const page = filters.page;
  const pageSize = filters.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("fiscal_inbound_dfe")
    .select(
      "id,company_id,environment,nsu,schema,chnfe,emit_cnpj,emit_nome,dest_cnpj,dh_emi,total,summary_json,has_full_xml,manifest_status,manifest_updated_at,created_at",
      { count: "exact" },
    )
    .eq("company_id", companyId)
    .order("dh_emi", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.environment) {
    query = query.eq("environment", filters.environment);
  }

  if (filters.dateFrom) {
    query = query.gte("dh_emi", `${filters.dateFrom}T00:00:00.000Z`);
  }

  if (filters.dateTo) {
    query = query.lte("dh_emi", `${filters.dateTo}T23:59:59.999Z`);
  }

  const emitter = normalizeEmitterSearch(filters.emitter);
  if (emitter) {
    const digits = emitter.replace(/\D/g, "");
    const orParts = [
      `emit_nome.ilike.%${emitter}%`,
      digits.length > 0 ? `emit_cnpj.ilike.%${digits}%` : null,
    ].filter((part): part is string => Boolean(part));

    if (orParts.length > 0) {
      query = query.or(orParts.join(","));
    }
  }

  const chnfe = normalizeChnfeSearch(filters.chnfe);
  if (chnfe) {
    query = query.ilike("chnfe", `%${chnfe}%`);
  }

  if (filters.manifestStatus) {
    query = query.eq("manifest_status", filters.manifestStatus);
  }

  if (filters.onlyFullXml) {
    query = query.eq("has_full_xml", true);
  }

  if (filters.tab === "pending") {
    query = query.eq("manifest_status", "SEM_MANIFESTACAO");
  } else if (filters.tab === "received") {
    query = query.eq("has_full_xml", true);
  } else if (filters.tab === "processing") {
    query = query.eq("has_full_xml", false);
  } else if (filters.tab === "cancelled") {
    query = query.or("summary_json.csit.eq.101,summary_json.cstat.eq.101,schema.eq.procEventoNFe");
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Falha ao listar NF-e de entrada: ${error.message}`);
  }

  const rows = z.array(InboundDocRowSchema).parse(data ?? []);
  return { rows, total: count ?? rows.length };
}

export async function listInboundManifestEvents(
  admin: AdminClient,
  args: {
    companyId: string;
    environment?: DfeEnvironment;
    page: number;
    pageSize: number;
  },
): Promise<{ rows: InboundManifestEventRow[]; total: number }> {
  const from = (args.page - 1) * args.pageSize;
  const to = from + args.pageSize - 1;

  let query = admin
    .from("fiscal_inbound_manifest_events")
    .select(
      "id,company_id,environment,chnfe,event_type,justification,status,sefaz_receipt,sefaz_protocol,last_error,created_at,updated_at",
      { count: "exact" },
    )
    .eq("company_id", args.companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (args.environment) {
    query = query.eq("environment", args.environment);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Falha ao listar eventos de manifestação: ${error.message}`);
  }

  const rows = z.array(ManifestEventRowSchema).parse(data ?? []);
  return { rows, total: count ?? rows.length };
}

export async function getInboundDfeById(
  admin: AdminClient,
  args: {
    companyId: string;
    id: string;
  },
): Promise<
  | (InboundDocRow & {
      xml_base64: string | null;
      xml_is_gz: boolean;
    })
  | null
> {
  const { data, error } = await admin
    .from("fiscal_inbound_dfe")
    .select(
      "id,company_id,environment,nsu,schema,chnfe,emit_cnpj,emit_nome,dest_cnpj,dh_emi,total,summary_json,has_full_xml,manifest_status,manifest_updated_at,created_at,xml_base64,xml_is_gz",
    )
    .eq("company_id", args.companyId)
    .eq("id", args.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar NF-e de entrada: ${error.message}`);
  }

  if (!data) return null;

  const base = InboundDocRowSchema.parse(data);
  const xmlBase64 = typeof data.xml_base64 === "string" ? data.xml_base64 : null;
  const xmlIsGz = Boolean(data.xml_is_gz);

  return {
    ...base,
    xml_base64: xmlBase64,
    xml_is_gz: xmlIsGz,
  };
}
