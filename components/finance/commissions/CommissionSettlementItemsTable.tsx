'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface SettlementDetailLineRow {
  itemType: 'RELEASE' | 'ENTITLEMENT' | 'ADJUSTMENT'
  amount: number
  orderId: string | null
  orderNumber: number | null
  customerName: string | null
  statusLogistico: string | null
  statusFinanceiro: string | null
  baseAmount: number
  commissionRate: number
  commissionAmount: number
}

interface GroupedOrderLines {
  key: string
  orderNumber: number | null
  customerName: string
  totalBase: number
  totalCommission: number
  averageRate: number
  logisticsStatusLabel: string
  financialStatusLabel: string
  items: Array<SettlementDetailLineRow & { lineKey: string }>
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

function buildGroupKey(line: SettlementDetailLineRow): string {
  if (line.orderId) {
    return `order:${line.orderId}`
  }

  if (line.orderNumber !== null) {
    return `number:${line.orderNumber}`
  }

  return 'order:unknown'
}

interface CommissionSettlementItemsTableProps {
  lines: SettlementDetailLineRow[]
}

export function CommissionSettlementItemsTable({ lines }: CommissionSettlementItemsTableProps) {
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())

  const groupedLines = useMemo<GroupedOrderLines[]>(() => {
    const grouped = new Map<string, GroupedOrderLines>()

    lines.forEach((line, index) => {
      const key = buildGroupKey(line)
      const lineKey = `${key}:${line.itemType}:${index}`
      const existing = grouped.get(key)
      if (existing) {
        existing.items.push({ ...line, lineKey })
        return
      }

      grouped.set(key, {
        key,
        orderNumber: line.orderNumber,
        customerName: line.customerName ?? 'Cliente não identificado',
        totalBase: line.baseAmount,
        totalCommission: line.commissionAmount,
        averageRate: line.commissionRate,
        logisticsStatusLabel: logisticsLabel[line.statusLogistico ?? ''] ?? line.statusLogistico ?? '-',
        financialStatusLabel: financialLabel[line.statusFinanceiro ?? ''] ?? line.statusFinanceiro ?? '-',
        items: [{ ...line, lineKey }],
      })
    })

    return Array.from(grouped.values())
      .map((group) => {
        const totalBase = group.items.reduce((acc, item) => acc + item.baseAmount, 0)
        const totalCommission = group.items.reduce((acc, item) => acc + item.commissionAmount, 0)
        const weightedRate = totalBase > 0 ? (totalCommission / totalBase) * 100 : 0

        const logisticsStatuses = new Set(
          group.items.map((item) => logisticsLabel[item.statusLogistico ?? ''] ?? item.statusLogistico ?? '-'),
        )
        const financialStatuses = new Set(
          group.items.map((item) => financialLabel[item.statusFinanceiro ?? ''] ?? item.statusFinanceiro ?? '-'),
        )

        return {
          ...group,
          totalBase,
          totalCommission,
          averageRate: weightedRate,
          logisticsStatusLabel: logisticsStatuses.size === 1 ? Array.from(logisticsStatuses)[0] : 'Múltiplos',
          financialStatusLabel: financialStatuses.size === 1 ? Array.from(financialStatuses)[0] : 'Múltiplos',
        }
      })
      .sort((a, b) => {
      if (a.orderNumber === null) return 1
      if (b.orderNumber === null) return -1
      return b.orderNumber - a.orderNumber
    })
  }, [lines])

  const toggleGroup = (key: string): void => {
    setExpandedGroupKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <Table>
      <TableHeader className="bg-gray-50">
        <TableRow>
          <TableHead className="w-[360px]">Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Logístico</TableHead>
          <TableHead>Financeiro</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-right">Comissão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupedLines.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-10 text-gray-500">
              Nenhum item vinculado a este acerto.
            </TableCell>
          </TableRow>
        )}

        {groupedLines.map((group) => {
          const isExpanded = expandedGroupKeys.has(group.key)

          return (
            <Fragment key={group.key}>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                <TableCell className="font-semibold text-gray-900">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      title={isExpanded ? 'Minimizar itens do pedido' : 'Expandir itens do pedido'}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </Button>
                    <span>Pedido #{group.orderNumber ?? '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-700">{group.customerName}</TableCell>
                <TableCell className="text-gray-600">{group.logisticsStatusLabel}</TableCell>
                <TableCell className="text-gray-600">{group.financialStatusLabel}</TableCell>
                <TableCell className="text-right font-semibold text-gray-900">
                  {formatCurrency(group.totalBase)}
                </TableCell>
                <TableCell className="text-right text-gray-700">
                  {group.averageRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </TableCell>
                <TableCell className="text-right font-semibold text-gray-900">{formatCurrency(group.totalCommission)}</TableCell>
              </TableRow>

              {isExpanded &&
                group.items.map((line) => (
                  <TableRow key={line.lineKey}>
                    <TableCell className="pl-16 text-sm text-gray-600">
                      #{line.orderNumber ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{line.customerName ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {logisticsLabel[line.statusLogistico ?? ''] ?? line.statusLogistico ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {financialLabel[line.statusFinanceiro ?? ''] ?? line.statusFinanceiro ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(line.baseAmount)}</TableCell>
                    <TableCell className="text-right text-gray-700">
                      {line.commissionRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(line.commissionAmount)}</TableCell>
                  </TableRow>
                ))}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
