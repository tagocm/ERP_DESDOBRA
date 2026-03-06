'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { ArrowLeft, Calendar, Check, ChevronRight, Loader2, Pencil, Save, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate, todayInBrasilia } from '@/lib/utils'
import {
  applyCommissionEntitlementRateOverrideAction,
  applyCommissionRateOverrideAction,
  createCommissionSettlementDraftAction,
  confirmCommissionSettlementAction,
  getCommissionRepOpenItemsAction,
} from '@/app/actions/commissions'
import {
  buildSettlementSelectionPayload,
  computeSettlementPreview,
} from '@/lib/domain/commissions/settlement-calculations'
import type {
  CommissionOpenItemRow,
  CommissionPaymentMode,
  CommissionRepresentativeOption,
} from '@/lib/domain/commissions/types'

const logisticsLabel: Record<string, string> = {
  pending: 'Pendente',
  routed: 'Roteirizado',
  scheduled: 'Agendado',
  expedition: 'Expedição',
  in_route: 'Em rota',
  delivered: 'Entregue',
  partial: 'Parcial',
  not_delivered: 'Não entregue',
  returned: 'Devolvido',
  cancelled: 'Cancelado',
  sandbox: 'Sandbox',
}

const financialLabel: Record<string, string> = {
  pending: 'Pendente',
  pre_posted: 'Pré-lançado',
  approved: 'Aprovado',
  in_review: 'Em revisão',
  cancelled: 'Cancelado',
  paid: 'Pago',
  overdue: 'Vencido',
  partial: 'Parcial',
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

interface GroupedOrder {
  orderId: string
  orderNumber: number | null
  customerName: string
  rows: CommissionOpenItemRow[]
  totalBase: number
  totalCommission: number
  totalReleased: number
  totalUnreleased: number
  averageRate: number
  logisticsStatusLabel: string
  financialStatusLabel: string
}

interface CommissionSettlementCreateClientProps {
  representatives: CommissionRepresentativeOption[]
}

export function CommissionSettlementCreateClient({ representatives }: CommissionSettlementCreateClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  const [repId, setRepId] = useState<string>('')
  const [cutoffDate, setCutoffDate] = useState<string>(todayInBrasilia())
  const [paymentMode, setPaymentMode] = useState<CommissionPaymentMode>('LIBERADO')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [payableDueDate, setPayableDueDate] = useState<string>(todayInBrasilia())
  const [rows, setRows] = useState<CommissionOpenItemRow[]>([])
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<Set<string>>(new Set())
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set())

  const [rateDialog, setRateDialog] = useState<{
    open: boolean
    scope: 'ORDER' | 'ITEM'
    orderId: string
    entitlementId: string
    deliveryLabel: string
    orderNumber: number | null
    currentRate: number
    newRate: string
    reason: string
  }>({
    open: false,
    scope: 'ORDER',
    orderId: '',
    entitlementId: '',
    deliveryLabel: '',
    orderNumber: null,
    currentRate: 0,
    newRate: '',
    reason: '',
  })

  const groupedOrders = useMemo<GroupedOrder[]>(() => {
    const grouped = new Map<string, GroupedOrder>()

    for (const row of rows) {
      const key = row.order_id
      const current = grouped.get(key)
      if (current) {
        current.rows.push(row)
      } else {
        grouped.set(key, {
          orderId: row.order_id,
          orderNumber: row.order_number,
          customerName: row.customer_name ?? 'Cliente sem nome',
          rows: [row],
          totalBase: 0,
          totalCommission: 0,
          totalReleased: 0,
          totalUnreleased: 0,
          averageRate: 0,
          logisticsStatusLabel: '-',
          financialStatusLabel: '-',
        })
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => (a.delivery_item_id > b.delivery_item_id ? 1 : -1)),
      }))
      .map((group) => {
        const totalBase = group.rows.reduce((acc, row) => acc + row.base_delivered_amount, 0)
        const totalCommission = group.rows.reduce((acc, row) => acc + row.commission_total, 0)
        const totalReleased = group.rows.reduce((acc, row) => acc + row.released_open_amount, 0)
        const totalUnreleased = group.rows.reduce((acc, row) => acc + row.unreleased_open_amount, 0)
        const ratesSum = group.rows.reduce((acc, row) => acc + row.commission_rate, 0)

        const averageRate = totalBase > 0
          ? (totalCommission / totalBase) * 100
          : (group.rows.length > 0 ? ratesSum / group.rows.length : 0)

        const logisticsLabels = new Set(
          group.rows.map((row) => logisticsLabel[row.status_logistico ?? ''] ?? row.status_logistico ?? '-'),
        )
        const financialLabels = new Set(
          group.rows.map((row) => financialLabel[row.status_financeiro ?? ''] ?? row.status_financeiro ?? '-'),
        )

        return {
          ...group,
          totalBase,
          totalCommission,
          totalReleased,
          totalUnreleased,
          averageRate,
          logisticsStatusLabel: logisticsLabels.size === 1 ? Array.from(logisticsLabels)[0] : 'Múltiplos',
          financialStatusLabel: financialLabels.size === 1 ? Array.from(financialLabels)[0] : 'Múltiplos',
        }
      })
      .sort((a, b) => {
        if (a.orderNumber === null) return 1
        if (b.orderNumber === null) return -1
        return b.orderNumber - a.orderNumber
      })
  }, [rows])

  const summary = useMemo(
    () => computeSettlementPreview(rows, selectedEntitlementIds, paymentMode),
    [rows, selectedEntitlementIds, paymentMode],
  )

  const selectedPayload = useMemo(
    () => buildSettlementSelectionPayload(rows, selectedEntitlementIds, paymentMode),
    [rows, selectedEntitlementIds, paymentMode],
  )
  const allEntitlementIds = useMemo(
    () => rows.map((row) => row.entitlement_id),
    [rows],
  )
  const allSelected = allEntitlementIds.length > 0 && allEntitlementIds.every((id) => selectedEntitlementIds.has(id))
  const partiallySelected = allEntitlementIds.some((id) => selectedEntitlementIds.has(id)) && !allSelected

  const reloadRows = (): void => {
    if (!repId) {
      setRows([])
      setSelectedEntitlementIds(new Set())
      return
    }

    setIsLoadingRows(true)

    startTransition(async () => {
      const result = await getCommissionRepOpenItemsAction({ repId, cutoffDate })
      if (!result.success) {
        toast({
          title: 'Erro ao carregar pendências',
          description: result.error,
          variant: 'destructive',
        })
        setRows([])
        setSelectedEntitlementIds(new Set())
        setIsLoadingRows(false)
        return
      }

      const defaults = new Set(
        result.data.filter((row) => row.default_selected).map((row) => row.entitlement_id),
      )

      setRows(result.data)
      setSelectedEntitlementIds(defaults)
      setExpandedOrderIds(new Set())
      setIsLoadingRows(false)
    })
  }

  const handleToggleOrder = (order: GroupedOrder, checked: boolean): void => {
    setSelectedEntitlementIds((previous) => {
      const next = new Set(previous)
      for (const row of order.rows) {
        if (checked) {
          next.add(row.entitlement_id)
        } else {
          next.delete(row.entitlement_id)
        }
      }
      return next
    })
  }

  const openRateDialog = (orderId: string, orderNumber: number | null, currentRate: number): void => {
    setRateDialog({
      open: true,
      scope: 'ORDER',
      orderId,
      entitlementId: '',
      deliveryLabel: '',
      orderNumber,
      currentRate,
      newRate: currentRate.toString(),
      reason: '',
    })
  }

  const openLineRateDialog = (row: CommissionOpenItemRow): void => {
    setRateDialog({
      open: true,
      scope: 'ITEM',
      orderId: row.order_id,
      entitlementId: row.entitlement_id,
      deliveryLabel: `Entrega ${row.delivery_item_id.slice(0, 8)}`,
      orderNumber: row.order_number,
      currentRate: row.commission_rate,
      newRate: row.commission_rate.toString(),
      reason: '',
    })
  }

  const toggleOrderExpanded = (orderId: string): void => {
    setExpandedOrderIds((previous) => {
      const next = new Set(previous)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const handleToggleAll = (checked: boolean): void => {
    if (!checked) {
      setSelectedEntitlementIds(new Set())
      return
    }
    setSelectedEntitlementIds(new Set(allEntitlementIds))
  }

  const closeRateDialog = (): void => {
    setRateDialog((previous) => ({ ...previous, open: false }))
  }

  const handleApplyRateOverride = (): void => {
    const parsedRate = Number(rateDialog.newRate)

    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      toast({
        title: 'Taxa inválida',
        description: 'Informe uma taxa entre 0 e 100%.',
        variant: 'destructive',
      })
      return
    }

    if (rateDialog.reason.trim().length < 3) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da alteração da comissão.',
        variant: 'destructive',
      })
      return
    }

    startTransition(async () => {
      const result = rateDialog.scope === 'ORDER'
        ? await applyCommissionRateOverrideAction({
            orderId: rateDialog.orderId,
            newRate: parsedRate,
            reason: rateDialog.reason.trim(),
            sourceContext: 'finance_commissions_ui',
          })
        : await applyCommissionEntitlementRateOverrideAction({
            entitlementId: rateDialog.entitlementId,
            newRate: parsedRate,
            reason: rateDialog.reason.trim(),
            sourceContext: 'finance_commissions_ui_item',
          })

      if (!result.success) {
        toast({
          title: rateDialog.scope === 'ORDER' ? 'Erro ao alterar comissão do pedido' : 'Erro ao alterar comissão do item',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Comissão atualizada',
        description: rateDialog.scope === 'ORDER'
          ? `Taxa do pedido alterada de ${formatPercent(result.data.old_rate)} para ${formatPercent(result.data.new_rate)}.`
          : `Taxa do item alterada de ${formatPercent(result.data.old_rate)} para ${formatPercent(result.data.new_rate)}.`,
      })

      closeRateDialog()
      reloadRows()
    })
  }

  const validateSettlementBeforeConfirm = (): boolean => {
    if (!repId) {
      toast({
        title: 'Representante obrigatório',
        description: 'Selecione o representante para criar o acerto.',
        variant: 'destructive',
      })
      return false
    }

    if (selectedPayload.length === 0 || summary.totalPayable <= 0) {
      toast({
        title: 'Sem itens selecionados',
        description: 'Selecione ao menos um item com valor elegível para acerto.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  const handleSaveDraft = (): void => {
    if (!repId) {
      toast({
        title: 'Representante obrigatório',
        description: 'Selecione o representante para salvar o rascunho.',
        variant: 'destructive',
      })
      return
    }

    if (selectedPayload.length === 0) {
      toast({
        title: 'Sem itens selecionados',
        description: 'Selecione ao menos um item para salvar o rascunho do acerto.',
        variant: 'destructive',
      })
      return
    }

    startTransition(async () => {
      const result = await createCommissionSettlementDraftAction({
        repId,
        cutoffDate,
        allowAdvance: paymentMode === 'ADIANTAMENTO',
        selectedItems: selectedPayload,
      })

      if (!result.success) {
        toast({
          title: 'Erro ao salvar rascunho',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Rascunho salvo',
        description: 'O acerto foi salvo como rascunho.',
      })

      router.push(`/app/financeiro/comissoes/${result.data.settlementId}`)
    })
  }

  const handleOpenConfirmDialog = (): void => {
    if (!validateSettlementBeforeConfirm()) {
      return
    }

    setPayableDueDate(cutoffDate)
    setConfirmDialogOpen(true)
  }

  const handleConfirmSettlement = (): void => {
    if (!validateSettlementBeforeConfirm()) {
      return
    }

    if (!payableDueDate) {
      toast({
        title: 'Vencimento obrigatório',
        description: 'Informe o vencimento da conta a pagar.',
        variant: 'destructive',
      })
      return
    }

    startTransition(async () => {
      const result = await confirmCommissionSettlementAction({
        repId,
        cutoffDate,
        allowAdvance: paymentMode === 'ADIANTAMENTO',
        selectedItems: selectedPayload,
        totalToPay: summary.totalPayable,
        requestKey: crypto.randomUUID(),
        payableDueDate,
      })

      if (!result.success) {
        toast({
          title: 'Erro ao confirmar acerto',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      setConfirmDialogOpen(false)
      toast({
        title: 'Acerto confirmado',
        description: `Acerto confirmado com total ${formatCurrency(result.data.total_paid)} e pré-lançamento em contas a pagar.`,
      })

      router.push(`/app/financeiro/comissoes/${result.data.settlement_id}`)
    })
  }

  const hasRows = rows.length > 0

  return (
    <div className="px-6 space-y-6 pb-10">
      <Card className="border-gray-200">
        <CardHeaderStandard
          title="Novo acerto de comissões"
          description="Selecione representante, confira os itens abertos e confirme o pagamento em lote."
          actions={
            <Link href="/app/financeiro/comissoes">
              <Button variant="pillOutline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
          }
        />

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Representante</Label>
              <Select value={repId} onValueChange={setRepId}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Selecione o representante" />
                </SelectTrigger>
                <SelectContent>
                  {representatives.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de corte</Label>
              <Input
                type="date"
                value={cutoffDate}
                onChange={(event) => setCutoffDate(event.target.value)}
                className="rounded-2xl"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="pillOutline"
                className="w-full"
                onClick={reloadRows}
                disabled={!repId || isPending}
              >
                {isLoadingRows ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                Carregar pendências
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 py-2">
            <Button
              variant={paymentMode === 'LIBERADO' ? 'pill' : 'pillOutline'}
              onClick={() => setPaymentMode('LIBERADO')}
              disabled={isPending}
            >
              Pagar somente liberado
            </Button>
            <Button
              variant={paymentMode === 'ADIANTAMENTO' ? 'pill' : 'pillOutline'}
              onClick={() => setPaymentMode('ADIANTAMENTO')}
              disabled={isPending}
            >
              Permitir adiantamento
            </Button>
          </div>

          <div className="min-h-0 overflow-auto border border-gray-200 rounded-2xl">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[48px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allSelected}
                        aria-checked={partiallySelected ? 'mixed' : undefined}
                        onCheckedChange={(checked) => handleToggleAll(checked === true)}
                        disabled={allEntitlementIds.length === 0}
                      />
                    </div>
                  </TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Liberado</TableHead>
                  <TableHead className="text-right">Não liberado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasRows && !isLoadingRows && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                      Selecione um representante e carregue as pendências.
                    </TableCell>
                  </TableRow>
                )}

                {isLoadingRows && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                      Carregando pendências...
                    </TableCell>
                  </TableRow>
                )}

                {groupedOrders.map((order) => {
                  const orderSelected = order.rows.every((row) => selectedEntitlementIds.has(row.entitlement_id))
                  const partiallySelected = order.rows.some((row) => selectedEntitlementIds.has(row.entitlement_id)) && !orderSelected
                  const orderRate = order.rows[0]?.commission_rate ?? 0
                  const isExpanded = expandedOrderIds.has(order.orderId)

                  return (
                    <Fragment key={`group-${order.orderId}`}>
                      <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                        <TableCell>
                          <Checkbox
                            checked={orderSelected}
                            aria-checked={partiallySelected ? 'mixed' : undefined}
                            onCheckedChange={(checked) => handleToggleOrder(order, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              title={isExpanded ? 'Minimizar itens do pedido' : 'Expandir itens do pedido'}
                              onClick={() => toggleOrderExpanded(order.orderId)}
                            >
                              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </Button>
                            <span>Pedido #{order.orderNumber ?? '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-gray-700">{order.customerName}</TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-gray-700">Logística: {order.logisticsStatusLabel}</div>
                          <div className="text-xs text-gray-500">Financeiro: {order.financialStatusLabel}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(order.totalBase)}</TableCell>
                        <TableCell className="text-right">{formatPercent(order.averageRate)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(order.totalCommission)}</TableCell>
                        <TableCell className="text-right text-emerald-700 font-semibold">{formatCurrency(order.totalReleased)}</TableCell>
                        <TableCell className="text-right text-amber-700 font-semibold">{formatCurrency(order.totalUnreleased)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Alterar taxa de comissão do pedido"
                            onClick={() => openRateDialog(order.orderId, order.orderNumber, orderRate)}
                          >
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && order.rows.map((row) => {
                        const rowSelected = selectedEntitlementIds.has(row.entitlement_id)

                        return (
                          <TableRow key={row.entitlement_id} data-state={rowSelected ? 'selected' : undefined}>
                            <TableCell>
                              <Checkbox
                                checked={rowSelected}
                                onCheckedChange={(checked) => {
                                  setSelectedEntitlementIds((previous) => {
                                    const next = new Set(previous)
                                    if (checked === true) {
                                      next.add(row.entitlement_id)
                                    } else {
                                      next.delete(row.entitlement_id)
                                    }
                                    return next
                                  })
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">#{row.order_number ?? '—'}</div>
                              <div className="text-xs text-gray-500">Entrega {row.delivery_item_id.slice(0, 8)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{row.customer_name ?? 'Cliente sem nome'}</div>
                              <div className="text-xs text-gray-500">{formatDate(row.delivered_date)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-medium text-gray-700">Logística: {logisticsLabel[row.status_logistico ?? ''] ?? row.status_logistico ?? '-'}</div>
                              <div className="text-xs text-gray-500">Financeiro: {financialLabel[row.status_financeiro ?? ''] ?? row.status_financeiro ?? '-'}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.base_delivered_amount)}</TableCell>
                            <TableCell className="text-right">{formatPercent(row.commission_rate)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(row.commission_total)}</TableCell>
                            <TableCell className="text-right text-emerald-700 font-semibold">{formatCurrency(row.released_open_amount)}</TableCell>
                            <TableCell className="text-right text-amber-700 font-semibold">{formatCurrency(row.unreleased_open_amount)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Alterar taxa de comissão somente deste item"
                                onClick={() => openLineRateDialog(row)}
                              >
                                <Pencil className="w-4 h-4 text-gray-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mt-4">
            <Card className="lg:col-span-3 border-gray-200">
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Linhas selecionadas</p>
                  <p className="text-xl font-bold text-gray-900">{summary.selectedLines}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total liberado</p>
                  <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.totalReleased)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total adiantamento</p>
                  <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.totalAdvance)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total a pagar</p>
                  <p className="text-xl font-black text-brand-700">{formatCurrency(summary.totalPayable)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Teto da comissão entregue</p>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(summary.deliveredCeiling)}</p>
                <p className="text-xs text-gray-500">Adiantamento nunca excede o teto entregue.</p>
              </CardContent>
            </Card>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
            <Link href="/app/financeiro/comissoes">
              <Button variant="pillOutline" disabled={isPending}>
                Cancelar
              </Button>
            </Link>
            <Button variant="pillOutline" onClick={handleSaveDraft} disabled={isPending || !repId}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar rascunho
            </Button>
            <Button variant="pill" onClick={handleOpenConfirmDialog} disabled={isPending || selectedPayload.length === 0}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Confirmar acerto
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar acerto e gerar conta a pagar</DialogTitle>
            <DialogDescription>
              Informe o vencimento do pré-lançamento que será enviado para aprovação em Contas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="payable-due-date">Data de vencimento</Label>
              <Input
                id="payable-due-date"
                type="date"
                value={payableDueDate}
                onChange={(event) => setPayableDueDate(event.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Total do acerto:</span> {formatCurrency(summary.totalPayable)}
            </div>
          </div>

          <DialogFooter>
            <Button variant="pillOutline" onClick={() => setConfirmDialogOpen(false)} disabled={isPending}>
              <X className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button variant="pill" onClick={handleConfirmSettlement} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Confirmar acerto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rateDialog.open} onOpenChange={(nextOpen) => (!nextOpen ? closeRateDialog() : undefined)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {rateDialog.scope === 'ORDER'
                ? `Alterar comissão do pedido #${rateDialog.orderNumber ?? '—'}`
                : `Alterar comissão do item (${rateDialog.deliveryLabel})`}
            </DialogTitle>
            <DialogDescription>
              {rateDialog.scope === 'ORDER'
                ? 'Esta ação atualiza a taxa de comissão do pedido e recalcula pendências ainda não liquidadas.'
                : 'Esta ação atualiza a taxa de comissão apenas deste item e recalcula pendências ainda não liquidadas.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-rate">Nova taxa (%)</Label>
              <Input
                id="new-rate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={rateDialog.newRate}
                onChange={(event) => setRateDialog((previous) => ({ ...previous, newRate: event.target.value }))}
                className="rounded-2xl"
              />
              <p className="text-xs text-gray-500">Taxa atual: {formatPercent(rateDialog.currentRate)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da alteração</Label>
              <Input
                id="reason"
                value={rateDialog.reason}
                onChange={(event) => setRateDialog((previous) => ({ ...previous, reason: event.target.value }))}
                placeholder="Descreva o motivo"
                className="rounded-2xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="pillOutline" onClick={closeRateDialog}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button variant="pill" onClick={handleApplyRateOverride}>
              <Check className="w-4 h-4 mr-2" />
              Salvar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
