import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { CommissionSettlementCreateClient } from '@/components/finance/commissions/CommissionSettlementCreateClient'
import { listCommissionRepresentativesAction } from '@/app/actions/commissions'

export const metadata: Metadata = {
  title: 'Novo Acerto de Comissões | Financeiro',
  description: 'Criação e conferência de fechamento de comissões por representante.',
}

export default async function FinanceCommissionCreatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const repsResult = await listCommissionRepresentativesAction()

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <PageHeader
        title="Novo acerto de comissões"
        subtitle="Configure representante e data de corte para abrir o fechamento completo em tela inteira."
      />

      <main>
        <CommissionSettlementCreateClient
          representatives={repsResult.success ? repsResult.data : []}
        />
      </main>
    </div>
  )
}
