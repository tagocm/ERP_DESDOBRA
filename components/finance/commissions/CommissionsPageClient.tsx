'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, Eye, Loader2, Plus, Printer, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Checkbox } from '@/components/ui/Checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { deleteCommissionSettlementDraftAction, listCommissionSettlementsAction } from '@/app/actions/commissions'
import type {
  CommissionRepresentativeOption,
  CommissionSettlementListItem,
  CommissionSettlementStatus,
} from '@/lib/domain/commissions/types'

const statusStyles: Record<CommissionSettlementStatus, string> = {
  RASCUNHO: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELADO: 'bg-rose-50 text-rose-700 border-rose-200',
}

const statusLabel: Record<CommissionSettlementStatus, string> = {
  RASCUNHO: 'Rascunho',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
}

const paymentStatusLabel: Record<string, string> = {
  PENDENTE_DE_APROVACAO: 'Pré-lançado',
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

interface CommissionsPageClientProps {
  initialSettlements: CommissionSettlementListItem[]
  representatives: CommissionRepresentativeOption[]
}

export function CommissionsPageClient({ initialSettlements }: CommissionsPageClientProps) {
  const { toast } = useToast()
  const [isRefreshing, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isBatchDeleting, startBatchDeleteTransition] = useTransition()
  const [settlements, setSettlements] = useState<CommissionSettlementListItem[]>(initialSettlements)
  const [draftToDelete, setDraftToDelete] = useState<CommissionSettlementListItem | null>(null)
  const [selectedSettlementIds, setSelectedSettlementIds] = useState<Set<string>>(new Set())
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [isBatchPrinting, setIsBatchPrinting] = useState(false)
  const [isBatchDownloading, setIsBatchDownloading] = useState(false)

  useEffect(() => {
    setSelectedSettlementIds((current) => {
      const availableIds = new Set(settlements.map((settlement) => settlement.id))
      const next = new Set(Array.from(current).filter((id) => availableIds.has(id)))
      if (next.size === current.size) {
        return current
      }
      return next
    })
  }, [settlements])

  const selectedSettlements = useMemo(
    () => settlements.filter((settlement) => selectedSettlementIds.has(settlement.id)),
    [settlements, selectedSettlementIds],
  )

  const selectedStats = useMemo(() => {
    const deletable = selectedSettlements.filter((settlement) => settlement.status === 'RASCUNHO').length
    const blocked = selectedSettlements.length - deletable
    return {
      total: selectedSettlements.length,
      deletable,
      blocked,
    }
  }, [selectedSettlements])

  const isAllSelected = settlements.length > 0 && selectedSettlementIds.size === settlements.length
  const isIndeterminate = selectedSettlementIds.size > 0 && selectedSettlementIds.size < settlements.length

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

  const handleSelectAll = (checked: boolean): void => {
    if (checked) {
      setSelectedSettlementIds(new Set(settlements.map((settlement) => settlement.id)))
      return
    }
    setSelectedSettlementIds(new Set())
  }

  const handleSelectSettlement = (settlementId: string, checked: boolean): void => {
    setSelectedSettlementIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(settlementId)
      } else {
        next.delete(settlementId)
      }
      return next
    })
  }

  const clearSelection = (): void => {
    setSelectedSettlementIds(new Set())
  }

  const handleBatchPrintAction = async (mode: 'pdf' | 'zip'): Promise<void> => {
    const selectedIds = Array.from(selectedSettlementIds)
    if (selectedIds.length === 0) {
      return
    }

    if (selectedIds.length > 50) {
      toast({
        title: 'Limite excedido',
        description: `O limite para ações em lote é 50 acertos. Você selecionou ${selectedIds.length}.`,
        variant: 'destructive',
      })
      return
    }

    if (mode === 'pdf') {
      setIsBatchPrinting(true)
    } else {
      setIsBatchDownloading(true)
    }

    try {
      const response = await fetch(`/api/finance/commissions/print-batch?mode=${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedIds }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Falha ao gerar arquivo em lote.' }))
        throw new Error(result.error || 'Falha ao gerar arquivo em lote.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const contentDisposition = response.headers.get('Content-Disposition')
      const fallbackName = mode === 'zip'
        ? `acertos_comissao_${new Date().toISOString().slice(0, 10)}.zip`
        : `acertos_comissao_${new Date().toISOString().slice(0, 10)}.pdf`
      const matchedFileName = contentDisposition?.match(/filename="?([^"]+)"?/i)?.[1]
      link.download = matchedFileName ?? fallbackName

      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)

      toast({
        title: mode === 'zip' ? 'Download iniciado' : 'PDF gerado',
        description: mode === 'zip'
          ? 'Arquivo ZIP dos acertos selecionados foi gerado com sucesso.'
          : 'PDF consolidado dos acertos selecionados foi gerado com sucesso.',
      })
    } catch (error) {
      toast({
        title: mode === 'zip' ? 'Erro ao baixar acertos' : 'Erro ao imprimir acertos',
        description: error instanceof Error ? error.message : 'Não foi possível processar os acertos selecionados.',
        variant: 'destructive',
      })
    } finally {
      setIsBatchPrinting(false)
      setIsBatchDownloading(false)
    }
  }

  const handleDeleteDraft = (): void => {
    if (!draftToDelete) {
      return
    }

    startDeleteTransition(async () => {
      const result = await deleteCommissionSettlementDraftAction({ settlementId: draftToDelete.id })
      if (!result.success) {
        toast({
          title: 'Erro ao excluir rascunho',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      setSettlements((current) => current.filter((settlement) => settlement.id !== draftToDelete.id))
      setDraftToDelete(null)
      toast({
        title: 'Rascunho excluído',
        description: 'O acerto foi removido e os itens voltaram para a fila de pendências.',
      })
    })
  }

  const handleBatchDelete = (): void => {
    const selectedDrafts = selectedSettlements.filter((settlement) => settlement.status === 'RASCUNHO')
    if (selectedDrafts.length === 0) {
      toast({
        title: 'Exclusão não permitida',
        description: 'Somente acertos em rascunho podem ser excluídos.',
        variant: 'destructive',
      })
      setBatchDeleteDialogOpen(false)
      return
    }

    startBatchDeleteTransition(async () => {
      const results = await Promise.all(
        selectedDrafts.map((settlement) =>
          deleteCommissionSettlementDraftAction({ settlementId: settlement.id }),
        ),
      )

      const deletedIds: string[] = []
      let failedCount = 0
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index]
        const settlement = selectedDrafts[index]
        if (!result.success || !settlement) {
          failedCount += 1
          continue
        }
        deletedIds.push(settlement.id)
      }

      if (deletedIds.length > 0) {
        setSettlements((current) => current.filter((settlement) => !deletedIds.includes(settlement.id)))
        setSelectedSettlementIds((current) => {
          const next = new Set(current)
          for (const id of deletedIds) {
            next.delete(id)
          }
          return next
        })
      }

      setBatchDeleteDialogOpen(false)

      const blockedCount = selectedStats.blocked
      if (failedCount > 0) {
        toast({
          title: 'Exclusão parcial',
          description: `Excluídos: ${deletedIds.length}. Falhas: ${failedCount}. Bloqueados: ${blockedCount}.`,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Exclusão concluída',
        description: `Excluídos: ${deletedIds.length}. Bloqueados: ${blockedCount}.`,
      })
    })
  }

  return (
    <div className="space-y-6 pb-10">
      <Dialog open={Boolean(draftToDelete)} onOpenChange={(open) => !open && setDraftToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir rascunho de acerto?</DialogTitle>
            <DialogDescription>
              Esta ação remove permanentemente o acerto em rascunho e libera os pedidos para novos acertos.
            </DialogDescription>
          </DialogHeader>

          {draftToDelete ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Acerto {typeof draftToDelete.document_number === 'number' ? `#${String(draftToDelete.document_number).padStart(4, '0')}` : '#----'}
              </div>
              <div className="mt-1 text-amber-900">
                Representante: {draftToDelete.rep_name ?? 'Representante sem nome'}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDraftToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteDraft}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir acertos selecionados?</DialogTitle>
            <DialogDescription>
              Apenas acertos com status <strong>Rascunho</strong> podem ser excluídos.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p>Total selecionado: <strong>{selectedStats.total}</strong></p>
            <p>Rascunhos que serão excluídos: <strong>{selectedStats.deletable}</strong></p>
            <p>Bloqueados (não rascunho): <strong>{selectedStats.blocked}</strong></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)} disabled={isBatchDeleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleBatchDelete} disabled={isBatchDeleting || selectedStats.deletable === 0}>
              {isBatchDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedSettlementIds.size > 0 ? (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700">
                {selectedSettlementIds.size} {selectedSettlementIds.size === 1 ? 'acerto selecionado' : 'acertos selecionados'}
              </div>
              <div className="h-4 w-px bg-brand-200" />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleBatchPrintAction('zip')
                  }}
                  disabled={isBatchPrinting || isBatchDownloading || isBatchDeleting}
                  className="h-8 gap-2 border-brand-200 bg-white font-medium text-brand-700 hover:bg-brand-50"
                >
                  {isBatchDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {isBatchDownloading ? 'Baixando...' : 'Baixar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleBatchPrintAction('pdf')
                  }}
                  disabled={isBatchPrinting || isBatchDownloading || isBatchDeleting}
                  className="h-8 gap-2 border-brand-200 bg-white font-medium text-brand-700 hover:bg-brand-50"
                >
                  {isBatchPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  {isBatchPrinting ? 'Imprimindo...' : 'Imprimir'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchDeleteDialogOpen(true)}
                  disabled={isBatchDeleting || isBatchPrinting || isBatchDownloading}
                  className="ml-1 h-8 gap-2 border-rose-200 bg-white font-medium text-rose-700 hover:bg-rose-50"
                >
                  {isBatchDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Excluir
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={isBatchDeleting || isBatchPrinting || isBatchDownloading}
              className="text-brand-700 hover:bg-brand-100 hover:text-brand-800"
            >
              <X className="mr-2 h-4 w-4" />
              Limpar seleção
            </Button>
          </div>
        </div>
      ) : null}

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
              <Link href="/app/financeiro/comissoes/novo">
                <Button variant="pill">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo acerto
                </Button>
              </Link>
            </div>
          }
        />

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[11%] text-center">Acerto</TableHead>
                <TableHead className="w-[27%] text-center">Representante</TableHead>
                <TableHead className="text-center">Corte</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Data Pagamento</TableHead>
                <TableHead className="text-center">Status Pagamento</TableHead>
                <TableHead className="text-right">Total pago</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-gray-500">
                    Nenhum acerto de comissão criado.
                  </TableCell>
                </TableRow>
              )}

              {settlements.map((settlement) => {
                const hasDocumentNumber = typeof settlement.document_number === 'number' && Number.isFinite(settlement.document_number)
                const displayCode = hasDocumentNumber
                  ? `#${String(settlement.document_number).padStart(4, '0')}`
                  : '#----'

                return (
                  <TableRow key={settlement.id}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedSettlementIds.has(settlement.id)}
                        onCheckedChange={(checked) => handleSelectSettlement(settlement.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="w-[11%]">
                      <div className="font-semibold text-gray-900">
                        {displayCode}
                      </div>
                      <div className="text-xs text-gray-500">Criado em {formatDate(settlement.created_at)}</div>
                    </TableCell>
                    <TableCell className="w-[27%]">
                      <div className="font-semibold text-gray-900">{settlement.rep_name ?? 'Representante sem nome'}</div>
                      <div className="text-xs text-gray-500">{settlement.allow_advance ? 'Com adiantamento' : 'Somente liberado'}</div>
                    </TableCell>
                    <TableCell className="text-center font-medium text-gray-700">{formatDate(settlement.cutoff_date)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusStyles[settlement.status]}`}>
                        {statusLabel[settlement.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium text-gray-700">
                      {settlement.payment_date ? formatDate(settlement.payment_date) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                        {settlement.payment_status ? (paymentStatusLabel[settlement.payment_status] ?? settlement.payment_status) : 'Não gerado'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">{formatCurrency(settlement.total_paid)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/api/finance/commissions/${settlement.id}/print`} target="_blank">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Imprimir acerto"
                            aria-label="Imprimir acerto"
                          >
                            <Printer className="h-4 w-4 text-gray-400" />
                          </Button>
                        </Link>
                        <Link href={`/app/financeiro/comissoes/${settlement.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Ver detalhe"
                            aria-label="Ver detalhe"
                          >
                            <Eye className="h-4 w-4 text-gray-400" />
                          </Button>
                        </Link>
                        {settlement.status === 'RASCUNHO' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Excluir rascunho"
                            aria-label="Excluir rascunho"
                            onClick={() => setDraftToDelete(settlement)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
