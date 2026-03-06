import type { createClient } from "@/utils/supabase/server";
import type {
  CommissionSettlementA4TemplateData,
  CommissionSettlementPrintOrderRow,
} from "@/lib/templates/print/commission-settlement-a4";
import { resolveCompanyLogoDataUri, resolveCompanyLogoUrl } from "@/lib/fiscal/nfe/logo-resolver";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface SettlementRow {
  id: string;
  document_number: number | null;
  rep_id: string;
  cutoff_date: string;
  status: string;
  total_paid: number;
}

interface SettlementItemRow {
  item_type: "RELEASE" | "ENTITLEMENT" | "ADJUSTMENT";
  item_id: string;
  amount: number;
}

interface ReleaseRow {
  id: string;
  order_id: string;
  entitlement_id: string;
  base_paid_amount: number;
}

interface EntitlementRow {
  id: string;
  order_id: string;
  base_delivered_amount: number;
  commission_rate: number;
}

interface SalesDocumentRow {
  id: string;
  document_number: number | null;
  client_id: string | null;
  status_logistic: string | null;
  financial_status: string | null;
  total_amount: number | null;
}

interface OrganizationRow {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  document_number: string | null;
  sales_rep_user_id: string | null;
  status: string | null;
  deleted_at: string | null;
  addresses?: RepresentativeAddressRow[] | null;
}

interface OrganizationRoleRow {
  organization: OrganizationRow | OrganizationRow[] | null;
}

interface RepresentativeAddressRow {
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface CompanySettingsRow {
  legal_name: string | null;
  trade_name: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  website: string | null;
}

interface FinancialEntryRow {
  due_date: string;
  status: string | null;
}

interface OrderContribution {
  orderId: string;
  baseAmount: number;
  weightedRateNumerator: number;
  commissionAmount: number;
}

export interface CommissionSettlementPrintDocument {
  settlementId: string;
  settlementNumber: number | null;
  displayNumber: string;
  data: CommissionSettlementA4TemplateData;
}

function asSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resolveAddressLines(companySettings: CompanySettingsRow | null): {
  streetLine: string | null;
  cityStateLine: string | null;
} {
  if (!companySettings) {
    return { streetLine: null, cityStateLine: null };
  }

  const streetLine =
    [companySettings.address_street, companySettings.address_number].filter(Boolean).join(", ") || null;
  const cityStateLine =
    [companySettings.address_neighborhood, companySettings.address_city, companySettings.address_state]
      .filter(Boolean)
      .join(" - ") || null;

  return { streetLine, cityStateLine };
}

function toContributionMap(
  items: SettlementItemRow[],
  releasesById: Map<string, ReleaseRow>,
  entitlementsById: Map<string, EntitlementRow>,
): Map<string, OrderContribution> {
  const byOrderId = new Map<string, OrderContribution>();

  for (const item of items) {
    if (item.item_type === "ADJUSTMENT") {
      continue;
    }

    if (item.item_type === "RELEASE") {
      const release = releasesById.get(item.item_id);
      if (!release) {
        continue;
      }
      const entitlement = entitlementsById.get(release.entitlement_id);
      const baseAmount = Number(release.base_paid_amount || 0);
      const commissionRate = entitlement ? Number(entitlement.commission_rate || 0) : 0;
      const previous = byOrderId.get(release.order_id);
      byOrderId.set(release.order_id, {
        orderId: release.order_id,
        baseAmount: Number(((previous?.baseAmount ?? 0) + baseAmount).toFixed(2)),
        weightedRateNumerator: Number(((previous?.weightedRateNumerator ?? 0) + baseAmount * commissionRate).toFixed(4)),
        commissionAmount: Number(((previous?.commissionAmount ?? 0) + Number(item.amount || 0)).toFixed(2)),
      });
      continue;
    }

    const entitlement = entitlementsById.get(item.item_id);
    if (!entitlement) {
      continue;
    }

    const baseAmount = Number(entitlement.base_delivered_amount || 0);
    const commissionRate = Number(entitlement.commission_rate || 0);
    const previous = byOrderId.get(entitlement.order_id);
    byOrderId.set(entitlement.order_id, {
      orderId: entitlement.order_id,
      baseAmount: Number(((previous?.baseAmount ?? 0) + baseAmount).toFixed(2)),
      weightedRateNumerator: Number(((previous?.weightedRateNumerator ?? 0) + baseAmount * commissionRate).toFixed(4)),
      commissionAmount: Number(((previous?.commissionAmount ?? 0) + Number(item.amount || 0)).toFixed(2)),
    });
  }

  return byOrderId;
}

interface RepresentativeProfile {
  name: string;
  document: string | null;
  address: string | null;
}

async function resolveRepresentativeProfile(
  supabase: SupabaseClient,
  companyId: string,
  repId: string,
): Promise<RepresentativeProfile> {
  const { data: roleRows, error: roleError } = await supabase
    .from("organization_roles")
    .select(
      `
        organization:organizations!organization_roles_organization_id_fkey(
          id,
          trade_name,
          legal_name,
          document_number,
          sales_rep_user_id,
          status,
          deleted_at,
          addresses(street, number, neighborhood, city, state)
        )
      `,
    )
    .eq("company_id", companyId)
    .eq("role", "representative")
    .is("deleted_at", null);

  if (roleError) {
    throw new Error(`Falha ao buscar representante: ${roleError.message}`);
  }

  for (const role of (roleRows ?? []) as OrganizationRoleRow[]) {
    const organization = asSingle(role.organization);
    if (!organization || organization.deleted_at !== null || organization.status !== "active") {
      continue;
    }

    if (organization.sales_rep_user_id === repId || organization.id === repId) {
      const representativeAddress = organization.addresses?.[0];
      const formattedAddress = representativeAddress
        ? [
            [representativeAddress.street, representativeAddress.number].filter(Boolean).join(", "),
            representativeAddress.neighborhood,
            [representativeAddress.city, representativeAddress.state].filter(Boolean).join("/"),
          ]
            .filter((value) => Boolean(value && value.trim().length > 0))
            .join(" - ")
        : null;

      return {
        name: organization.trade_name || organization.legal_name || "Representante",
        document: organization.document_number || null,
        address: formattedAddress,
      };
    }
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("full_name")
    .eq("company_id", companyId)
    .eq("id", repId)
    .is("deleted_at", null)
    .maybeSingle();

  if (userError) {
    throw new Error(`Falha ao buscar nome do representante: ${userError.message}`);
  }

  return {
    name: userRow?.full_name || "Representante",
    document: null,
    address: null,
  };
}

export async function buildCommissionSettlementPrintDocument(
  supabase: SupabaseClient,
  companyId: string,
  settlementId: string,
): Promise<CommissionSettlementPrintDocument> {
  const { data: settlementData, error: settlementError } = await supabase
    .from("commission_settlements")
    .select("id, document_number, rep_id, cutoff_date, status, total_paid")
    .eq("company_id", companyId)
    .eq("id", settlementId)
    .single();

  if (settlementError || !settlementData) {
    throw new Error(settlementError?.message ?? "Acerto não encontrado.");
  }

  const settlement = settlementData as SettlementRow;
  const representative = await resolveRepresentativeProfile(supabase, companyId, settlement.rep_id);

  const [itemsResult, paymentEntryResult, settingsResult] = await Promise.all([
    supabase
      .from("commission_settlement_items")
      .select("item_type, item_id, amount")
      .eq("settlement_id", settlementId),
    supabase
      .from("financial_entries")
      .select("due_date, status")
      .eq("company_id", companyId)
      .eq("origin_type", "COMMISSION_SETTLEMENT")
      .eq("origin_id", settlementId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("company_settings")
      .select(
        "legal_name, trade_name, address_street, address_number, address_neighborhood, address_city, address_state, website",
      )
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (itemsResult.error) {
    throw new Error(`Falha ao carregar itens do acerto: ${itemsResult.error.message}`);
  }
  if (paymentEntryResult.error) {
    throw new Error(`Falha ao carregar status de pagamento do acerto: ${paymentEntryResult.error.message}`);
  }
  if (settingsResult.error) {
    throw new Error(`Falha ao carregar dados da empresa: ${settingsResult.error.message}`);
  }

  const settlementItems = ((itemsResult.data ?? []) as SettlementItemRow[]).filter(
    (item) => item.item_type === "RELEASE" || item.item_type === "ENTITLEMENT" || item.item_type === "ADJUSTMENT",
  );

  const releaseIds = settlementItems
    .filter((item) => item.item_type === "RELEASE")
    .map((item) => item.item_id);
  const entitlementIds = settlementItems
    .filter((item) => item.item_type === "ENTITLEMENT")
    .map((item) => item.item_id);

  const releaseRowsResult = releaseIds.length > 0
    ? await supabase
        .from("commission_releases")
        .select("id, order_id, entitlement_id, base_paid_amount")
        .eq("company_id", companyId)
        .in("id", releaseIds)
    : { data: [], error: null };

  if (releaseRowsResult.error) {
    throw new Error(`Falha ao carregar releases do acerto: ${releaseRowsResult.error.message}`);
  }

  const releases = (releaseRowsResult.data ?? []) as ReleaseRow[];
  const releasesById = new Map(releases.map((release) => [release.id, release]));

  const allEntitlementIds = Array.from(
    new Set([...entitlementIds, ...releases.map((release) => release.entitlement_id)]),
  );

  const entitlementRowsResult = allEntitlementIds.length > 0
    ? await supabase
        .from("commission_entitlements")
        .select("id, order_id, base_delivered_amount, commission_rate")
        .eq("company_id", companyId)
        .in("id", allEntitlementIds)
    : { data: [], error: null };

  if (entitlementRowsResult.error) {
    throw new Error(`Falha ao carregar entitlement do acerto: ${entitlementRowsResult.error.message}`);
  }

  const entitlements = (entitlementRowsResult.data ?? []) as EntitlementRow[];
  const entitlementsById = new Map(entitlements.map((entitlement) => [entitlement.id, entitlement]));

  const contributionsByOrderId = toContributionMap(settlementItems, releasesById, entitlementsById);
  const orderIds = Array.from(contributionsByOrderId.keys());

  const salesDocumentsResult = orderIds.length > 0
    ? await supabase
        .from("sales_documents")
        .select("id, document_number, client_id, status_logistic, financial_status, total_amount")
        .eq("company_id", companyId)
        .in("id", orderIds)
    : { data: [], error: null };

  if (salesDocumentsResult.error) {
    throw new Error(`Falha ao carregar pedidos do acerto: ${salesDocumentsResult.error.message}`);
  }

  const salesDocuments = (salesDocumentsResult.data ?? []) as SalesDocumentRow[];
  const salesById = new Map(salesDocuments.map((order) => [order.id, order]));

  const customerIds = Array.from(
    new Set(
      salesDocuments
        .map((order) => order.client_id)
        .filter((clientId): clientId is string => typeof clientId === "string" && clientId.length > 0),
    ),
  );

  const customersResult = customerIds.length > 0
    ? await supabase
        .from("organizations")
        .select("id, trade_name, legal_name")
        .eq("company_id", companyId)
        .in("id", customerIds)
    : { data: [], error: null };

  if (customersResult.error) {
    throw new Error(`Falha ao carregar clientes dos pedidos: ${customersResult.error.message}`);
  }

  const customerNameById = new Map<string, string>();
  for (const customer of (customersResult.data ?? []) as OrganizationRow[]) {
    customerNameById.set(customer.id, customer.trade_name || customer.legal_name || "Cliente");
  }

  const orders: CommissionSettlementPrintOrderRow[] = Array.from(contributionsByOrderId.values())
    .map((contribution) => {
      const order = salesById.get(contribution.orderId);
      const customerName = order?.client_id ? customerNameById.get(order.client_id) : undefined;
      const commissionRate =
        contribution.baseAmount > 0
          ? Number((contribution.weightedRateNumerator / contribution.baseAmount).toFixed(2))
          : 0;

      return {
        order_number: order?.document_number ?? null,
        customer_name: customerName || "Cliente",
        logistic_status: order?.status_logistic ?? null,
        financial_status: order?.financial_status ?? null,
        order_total_amount: Number(order?.total_amount ?? contribution.baseAmount ?? 0),
        commission_rate: commissionRate,
        commission_amount: Number(contribution.commissionAmount.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (a.order_number === null) {
        return 1;
      }
      if (b.order_number === null) {
        return -1;
      }
      return b.order_number - a.order_number;
    });

  const totalOrdersAmount = Number(
    orders.reduce((acc, order) => acc + Number(order.order_total_amount || 0), 0).toFixed(2),
  );
  const totalCommissionAmount = Number(
    orders.reduce((acc, order) => acc + Number(order.commission_amount || 0), 0).toFixed(2),
  );

  const paymentEntry = ((paymentEntryResult.data ?? []) as FinancialEntryRow[])[0] ?? null;
  const logoDataUri =
    (await resolveCompanyLogoDataUri(supabase, companyId)) ||
    (await resolveCompanyLogoUrl(supabase, companyId)) ||
    null;
  const companySettings = (settingsResult.data ?? null) as CompanySettingsRow | null;
  const { streetLine, cityStateLine } = resolveAddressLines(companySettings);

  const displayNumber =
    settlement.document_number !== null
      ? String(settlement.document_number).padStart(4, "0")
      : settlement.id.slice(0, 8).toUpperCase();

  return {
    settlementId: settlement.id,
    settlementNumber: settlement.document_number,
    displayNumber,
    data: {
      company: {
        legal_name: companySettings?.legal_name ?? companySettings?.trade_name ?? "EMPRESA",
        trade_name: companySettings?.trade_name ?? null,
        address_street: streetLine,
        address_number: null,
        address_neighborhood: cityStateLine,
        address_city: null,
        address_state: null,
        website: companySettings?.website ?? null,
        logo_url: logoDataUri,
      },
      settlement: {
        settlement_id: settlement.id,
        settlement_number: settlement.document_number,
        representative_name: representative.name,
        representative_document: representative.document,
        representative_address: representative.address,
        cutoff_date: settlement.cutoff_date,
        generated_at: new Date().toISOString(),
        payment_due_date: paymentEntry?.due_date ?? null,
        payment_status: paymentEntry?.status ?? null,
        total_paid: Number(settlement.total_paid || 0),
        total_orders_amount: totalOrdersAmount,
        total_commission_amount: totalCommissionAmount,
        status: settlement.status,
      },
      orders,
    },
  };
}
