'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { FileText, ArrowUpRight, ArrowDownLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PreApprovalActions } from './PreApprovalActions'
import { FinancialEvent } from '@/lib/finance/events-db'

interface Title {
    id: string
    type: 'AR' | 'AP'
    entity_name: string
    amount_total: number
    date_issued: string
    attention_status?: string
    attention_reason?: string
    payment_terms_snapshot?: string
}

interface PreApprovalListProps {
    data: Title[]
    isLoading: boolean
    onRefresh: () => void
}

function mapTitleToEvent(t: Title): FinancialEvent {
    return {
        id: t.id,
        direction: t.type,
        partner_name: t.entity_name,
        total_amount: t.amount_total,
        issue_date: t.date_issued,
        attention_reason: t.attention_reason || null,
        status: (t.attention_status as any) || 'pendente',
        // Defaults for required fields not in Title view
        company_id: '',
        origin_type: 'MANUAL',
        origin_id: null,
        origin_reference: null,
        partner_id: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
        approval_snapshot: null,
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
        attention_marked_by: null,
        attention_marked_at: null,
        installments: []
    }
}

export function PreApprovalList({ data, isLoading, onRefresh }: PreApprovalListProps) {
    const [selectedTitle, setSelectedTitle] = useState<Title | null>(null)

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Carregando pendências...</div>
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center border border-gray-200 rounded-lg bg-gray-50 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Tudo Aprovado!</h3>
                <p>Não há lançamentos pendentes de aprovação.</p>
            </div>
        )
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                        <tr>
                            <th className="px-6 py-4 w-12">Tipo</th>
                            <th className="px-6 py-4">Parceiro / Entidade</th>
                            <th className="px-6 py-4 w-[140px]">Emissão</th>
                            <th className="px-6 py-4">Detalhes / Termos</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                            <th className="px-6 py-4 w-[140px] text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((title) => (
                            <tr
                                key={title.id}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => setSelectedTitle(title)}
                            >
                                <td className="px-6 py-4">
                                    {title.type === 'AR' ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex w-fit gap-1">
                                            <ArrowUpRight className="w-3 h-3" /> Receber
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex w-fit gap-1">
                                            <ArrowDownLeft className="w-3 h-3" /> Pagar
                                        </Badge>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {title.entity_name}
                                    {title.attention_status && (
                                        <div className="text-xs text-amber-600 flex items-center gap-1 mt-1 font-normal">
                                            <AlertTriangle className="w-3 h-3" />
                                            {title.attention_reason || 'Dados incompletos'}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    {format(new Date(title.date_issued), 'dd/MM/yyyy')}
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-xs">
                                    {title.payment_terms_snapshot || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                    {Number(title.amount_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTitle(title); }}>
                                        Revisar
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <PreApprovalActions
                isOpen={!!selectedTitle}
                onClose={() => setSelectedTitle(null)}
                title={selectedTitle ? mapTitleToEvent(selectedTitle) : null}
                onSuccess={onRefresh}
            />
        </div>
    )
}
