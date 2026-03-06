import { createClient } from "@/utils/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleTabs } from "@/components/app/ModuleTabs";
import { InboundDfePageClient } from "@/components/fiscal/inbound/InboundDfePageClient";
import { InboundSyncNowButton } from "@/components/fiscal/inbound/InboundSyncNowButton";
import { createAdminClient } from "@/lib/supabaseServer";
import { resolveEnvironmentForCompany } from "@/lib/fiscal/inbound/service";

const tabs = [
  {
    name: "Notas de Saída",
    href: "/app/fiscal/nfe",
  },
  {
    name: "Notas de Entrada",
    href: "/app/fiscal/configuracoes",
  },
  {
    name: "Importar XML (Legado)",
    href: "/app/fiscal/nfe/importar-legado",
  },
];

export default async function NFeEntradaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("auth_user_id", user?.id)
    .single();

  const companyId = member?.company_id;
  if (!companyId) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Usuário sem empresa vinculada.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const environment = await resolveEnvironmentForCompany(admin, companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais"
        subtitle="Acompanhe NF-e de entrada via Distribuição DF-e, com XML, DANFE e manifestação do destinatário."
        actions={
          <div className="flex gap-2">
            <InboundSyncNowButton environment={environment} />
          </div>
        }
      >
        <ModuleTabs items={tabs} />
      </PageHeader>

      <div className="px-6">
        <InboundDfePageClient initialEnvironment={environment} />
      </div>
    </div>
  );
}
