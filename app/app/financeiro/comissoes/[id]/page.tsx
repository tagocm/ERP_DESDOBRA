import Link from 'next/link'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getCommissionSettlementDetailAction } from '@/app/actions/commissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard'
import { CommissionSettlementItemsTable } from '@/components/finance/commissions/CommissionSettlementItemsTable'
import { formatCurrency, formatDate } from '@/lib/utils'

interface CommissionSettlementDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CommissionSettlementDetailPageProps): Promise<Metadata> {
  const resolved = await params
  return {
    title: `Acerto ${resolved.id.slice(0, 8)} | Comissões`,
  }
}

export default async function CommissionSettlementDetailPage({ params }: CommissionSettlementDetailPageProps) {
  const resolved = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const result = await getCommissionSettlementDetailAction({ settlementId: resolved.id })

  if (!result.success) {
    return (
      <div className="space-y-6 pb-10 animate-in fade-in duration-500">
        <PageHeader
          title="Acerto não disponível"
          subtitle={result.error}
          actions={
            <div className="flex items-center gap-2">
              <Link href={`/api/finance/commissions/${resolved.id}/print`} target="_blank">
                <Button variant="pillOutline">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </Link>
              <Link href="/app/financeiro/comissoes">
                <Button variant="pillOutline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para acertos
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  const detail = result.data

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <PageHeader
        title={
          detail.header.document_number === null
            ? `Acerto #${detail.header.id.slice(0, 8)}`
            : `Acerto #${String(detail.header.document_number).padStart(4, '0')}`
        }
        subtitle={`Representante: ${detail.header.rep_name ?? 'Sem representante'} • Corte: ${formatDate(detail.header.cutoff_date)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/api/finance/commissions/${resolved.id}/print`} target="_blank">
              <Button variant="pillOutline">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </Link>
            <Link href="/app/financeiro/comissoes">
              <Button variant="pillOutline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para acertos
              </Button>
            </Link>
          </div>
        }
      />

      <main className="px-6 space-y-6">
        <Card className="border-gray-200">
          <CardHeaderStandard
            title="Resumo do acerto"
            description="Visão consolidada dos valores liquidados neste lote."
          />
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
              <p className="text-lg font-bold text-gray-900">{detail.header.status}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Liberado</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(detail.summary.releases)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Adiantamento</p>
              <p className="text-lg font-bold text-amber-700">{formatCurrency(detail.summary.advances)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Total pago</p>
              <p className="text-lg font-black text-brand-700">{formatCurrency(detail.summary.total)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeaderStandard
            title="Itens liquidados"
            description="Detalhamento por release/entitlement vinculado ao acerto."
          />
          <CardContent className="p-0">
            <CommissionSettlementItemsTable lines={detail.lines} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
