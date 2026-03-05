'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { Calendar, Check, Loader2, Pencil, Plus, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'
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
  applyCommissionRateOverrideAction,
  buildCommissionSettlementPayload,
  buildCommissionSettlementPreview,
  confirmCommissionSettlementAction,
  getCommissionRepOpenItemsAction,
  listCommissionRepresentativesAction,
  listCommissionSettlementsAction,
} from '@/app/actions/commissions'
import type {
  CommissionOpenItemRow,
  CommissionPaymentMode,
  CommissionRepresentativeOption,
  CommissionSettlementListItem,
} from '@/lib/domain/commissions/types'

type SettlementStatus = 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO'

const statusStyles: Record<SettlementStatus, string> = {
  RASCUNHO: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELADO: 'bg-rose-50 text-rose-700 border-rose-200',
}

const statusLabel: Record<SettlementStatus, string> = {
  RASCUNHO: 'Rascunho',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
}

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
}

interface NewSettlementDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  representatives: CommissionRepresentativeOption[]
}

function NewSettlementDialog({ open, onClose, onSaved, representatives }: NewSettlementDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  const [repId, setRepId] = useState<string>('')
  const [cutoffDate, setCutoffDate] = useState<string>(todayInBrasilia())
  const [paymentMode, setPaymentMode] = useState<CommissionPaymentMode>('LIBERADO')
  const [rows, setRows] = useState<CommissionOpenItemRow[]>([])
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<Set<string>>(new Set())

  const [rateDialog, setRateDialog] = useState<{
    open: boolean
    orderId: string
    orderNumber: number | null
    currentRate: number
    newRate: string
    reason: string
  }>({
    open: false,
    orderId: '',
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
        })
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => (a.delivery_item_id > b.delivery_item_id ? 1 : -1)),
      }))
      .sort((a, b) => {
        if (a.orderNumber === null) return 1
        if (b.orderNumber === null) return -1
        return b.orderNumber - a.orderNumber
      })
  }, [rows])

  const summary = useMemo(
    () => buildCommissionSettlementPreview(rows, selectedEntitlementIds, paymentMode),
    [rows, selectedEntitlementIds, paymentMode],
  )

  const selectedPayload = useMemo(
    () => buildCommissionSettlementPayload(rows, selectedEntitlementIds, paymentMode),
    [rows, selectedEntitlementIds, paymentMode],
  )

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
      orderId,
      orderNumber,
      currentRate,
      newRate: currentRate.toString(),
      reason: '',
    })
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
      const result = await applyCommissionRateOverrideAction({
        orderId: rateDialog.orderId,
        newRate: parsedRate,
        reason: rateDialog.reason.trim(),
        sourceContext: 'finance_commissions_ui',
      })

      if (!result.success) {
        toast({
          title: 'Erro ao alterar comissão',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Comissão atualizada',
        description: `Taxa alterada de ${formatPercent(result.data.old_rate)} para ${formatPercent(result.data.new_rate)}.`,
      })

      closeRateDialog()
      reloadRows()
    })
  }

  const handleConfirmSettlement = (): void => {
    if (!repId) {
      toast({
        title: 'Representante obrigatório',
        description: 'Selecione o representante para criar o acerto.',
        variant: 'destructive',
      })
      return
    }

    if (selectedPayload.length === 0 || summary.totalPayable <= 0) {
      toast({
        title: 'Sem itens selecionados',
        description: 'Selecione ao menos um item com valor elegível para acerto.',
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
      })

      if (!result.success) {
        toast({
          title: 'Erro ao confirmar acerto',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Acerto confirmado',
        description: `Acerto confirmado com total ${formatCurrency(result.data.total_paid)}.`,
      })

      onSaved()
      onClose()

      setRows([])
      setSelectedEntitlementIds(new Set())
      setRepId('')
      setPaymentMode('LIBERADO')
      setCutoffDate(todayInBrasilia())
    })
  }

  const hasRows = rows.length > 0

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Novo acerto de comissões</DialogTitle>
            <DialogDescription>
              Selecione representante, confira os itens abertos e confirme o pagamento em lote.
            </DialogDescription>
          </DialogHeader>

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

          <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-2xl">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[48px]">Sel.</TableHead>
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

                  return (
                    <Fragment key={`group-${order.orderId}`}>
                      <TableRow key={`group-${order.orderId}`} className="bg-gray-50/80 hover:bg-gray-50/80">
                        <TableCell>
                          <Checkbox
                            checked={orderSelected}
                            aria-checked={partiallySelected ? 'mixed' : undefined}
                            onCheckedChange={(checked) => handleToggleOrder(order, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          Pedido #{order.orderNumber ?? '—'}
                        </TableCell>
                        <TableCell className="font-medium text-gray-700">{order.customerName}</TableCell>
                        <TableCell colSpan={5} className="text-xs text-gray-500">
                          {order.rows.length} item(ns) de comissão
                        </TableCell>
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

                      {order.rows.map((row) => {
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
                              <span className="text-xs text-gray-500">Máx. {formatCurrency(row.max_payable_amount)}</span>
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

          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button variant="pillOutline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="pill" onClick={handleConfirmSettlement} disabled={isPending || selectedPayload.length === 0}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Confirmar acerto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rateDialog.open} onOpenChange={(nextOpen) => (!nextOpen ? closeRateDialog() : undefined)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Alterar comissão do pedido #{rateDialog.orderNumber ?? '—'}</DialogTitle>
            <DialogDescription>
              Esta ação atualiza a taxa de comissão do pedido e recalcula pendências ainda não liquidadas.
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
    </>
  )
}

interface CommissionsPageClientProps {
  initialSettlements: CommissionSettlementListItem[]
  representatives: CommissionRepresentativeOption[]
}

export function CommissionsPageClient({ initialSettlements, representatives }: CommissionsPageClientProps) {
  const { toast } = useToast()
  const [isRefreshing, startTransition] = useTransition()
  const [settlements, setSettlements] = useState<CommissionSettlementListItem[]>(initialSettlements)
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  const refreshSettlements = (): void => {
    startTransition(async () => {
      const result = await listCommissionSettlementsAction()
      if (!result.success) {
        toast({
          title: 'Erro ao atualizar acertos',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      setSettlements(result.data)
    })
  }

  return (
    <div className="space-y-6 pb-10">
      <Card className="border-gray-200">
        <CardHeaderStandard
          title="Acertos de Comissão"
          description="Consolide pagamentos por representante com rastreabilidade e idempotência."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="pillOutline" onClick={refreshSettlements} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Atualizar
              </Button>
              <Button variant="pill" onClick={() => setNewDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo acerto
              </Button>
            </div>
          }
        />

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Acerto</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Corte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total pago</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                    Nenhum acerto de comissão criado.
                  </TableCell>
                </TableRow>
              )}

              {settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell>
                    <div className="font-semibold text-gray-900">#{settlement.id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-500">Criado em {formatDate(settlement.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-gray-900">{settlement.rep_name ?? 'Representante sem nome'}</div>
                    <div className="text-xs text-gray-500">{settlement.allow_advance ? 'Com adiantamento' : 'Somente liberado'}</div>
                  </TableCell>
                  <TableCell className="font-medium text-gray-700">{formatDate(settlement.cutoff_date)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusStyles[settlement.status]}`}>
                      {statusLabel[settlement.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900">{formatCurrency(settlement.total_paid)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/app/financeiro/comissoes/${settlement.id}`}>
                      <Button variant="ghost" size="sm" className="text-brand-700 hover:text-brand-800">
                        Ver detalhe
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewSettlementDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onSaved={refreshSettlements}
        representatives={representatives}
      />
    </div>
  )
}
