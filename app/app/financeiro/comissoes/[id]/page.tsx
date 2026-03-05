import Link from 'next/link'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getCommissionSettlementDetailAction } from '@/app/actions/commissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'

interface CommissionSettlementDetailPageProps {
  params: Promise<{ id: string }>
}

const itemTypeLabel: Record<string, string> = {
  RELEASE: 'Liberado',
  ENTITLEMENT: 'Adiantamento',
  ADJUSTMENT: 'Ajuste',
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
    notFound()
  }

  const detail = result.data

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <PageHeader
        title={`Acerto #${detail.header.id.slice(0, 8)}`}
        subtitle={`Representante: ${detail.header.rep_name ?? 'Sem representante'} • Corte: ${formatDate(detail.header.cutoff_date)}`}
        actions={
          <Link href="/app/financeiro/comissoes">
            <Button variant="pillOutline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para acertos
            </Button>
          </Link>
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
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-500">
                      Nenhum item vinculado a este acerto.
                    </TableCell>
                  </TableRow>
                )}

                {detail.lines.map((line, index) => (
                  <TableRow key={`${line.itemType}-${line.orderId ?? 'na'}-${index}`}>
                    <TableCell className="font-semibold">{itemTypeLabel[line.itemType] ?? line.itemType}</TableCell>
                    <TableCell>#{line.orderNumber ?? '—'}</TableCell>
                    <TableCell>{line.customerName ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(line.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
