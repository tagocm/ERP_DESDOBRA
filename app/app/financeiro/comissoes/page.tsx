import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { CommissionsPageClient } from '@/components/finance/commissions/CommissionsPageClient'
import { listCommissionRepresentativesAction, listCommissionSettlementsAction } from '@/app/actions/commissions'

export const metadata: Metadata = {
  title: 'Comissões | Financeiro',
  description: 'Acerto de comissões por representante.',
}

export default async function FinanceCommissionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [repsResult, settlementsResult] = await Promise.all([
    listCommissionRepresentativesAction(),
    listCommissionSettlementsAction(),
  ])

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <PageHeader
        title="Comissões"
        subtitle="Consolide acertos por representante com controle de liberação, adiantamento e rastreabilidade completa."
      />

      <main className="px-6">
        <CommissionsPageClient
          representatives={repsResult.success ? repsResult.data : []}
          initialSettlements={settlementsResult.success ? settlementsResult.data : []}
        />
      </main>
    </div>
  )
}
