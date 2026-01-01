"use client";

import { ArTitle, ArInstallment } from "@/types/financial";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { InstallmentPaymentManager } from "./InstallmentPaymentManager";
import { CircleDollarSign, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";

interface AccountsRowExpandedProps {
    title: ArTitle;
    onRefresh: () => void;
}

export function AccountsRowExpanded({ title, onRefresh }: AccountsRowExpandedProps) {
    const installments = title.ar_installments?.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Aberta</Badge>;
            case 'PARTIAL': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Parcial</Badge>;
            case 'PAID': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paga</Badge>;
            case 'OVERDUE': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Vencida</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-4 animate-in slide-in-from-top-2">

            {/* Attention Banner if needed */}
            {title.attention_status === 'EM_ATENCAO' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-yellow-800">Este título requer atenção</h4>
                        <p className="text-sm text-yellow-700">{title.attention_reason}</p>
                        {title.attention_at && (
                            <span className="text-xs text-yellow-600/80 mt-1 block">Marcado em: {new Date(title.attention_at).toLocaleString('pt-BR')}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-gray-50 border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</span>
                    <span className="text-xl font-black text-gray-900">{formatCurrency(title.amount_total)}</span>
                </Card>
                <Card className="p-4 bg-green-50 border-green-100 flex flex-col justify-between">
                    <span className="text-xs font-medium text-green-600 uppercase tracking-wider">Valor Pago</span>
                    <span className="text-xl font-black text-green-700">{formatCurrency(title.amount_paid)}</span>
                </Card>
                <Card className="p-4 bg-white border-blue-100 shadow-sm flex flex-col justify-between ring-1 ring-blue-50">
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Saldo em Aberto</span>
                    <span className="text-xl font-black text-blue-700">{formatCurrency(title.amount_open)}</span>
                </Card>
            </div>

            {/* Installments Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-500 uppercase font-medium">
                        <tr>
                            <th className="px-4 py-3 text-left w-16">#</th>
                            <th className="px-4 py-3 text-left">Vencimento</th>
                            <th className="px-4 py-3 text-right">Valor Original</th>
                            <th className="px-4 py-3 text-right">Encargos/Desc.</th>
                            <th className="px-4 py-3 text-right">Pago</th>
                            <th className="px-4 py-3 text-right">Saldo</th>
                            <th className="px-4 py-3 text-center">Situação</th>
                            <th className="px-4 py-3 text-right w-32">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {installments.map((inst, idx) => (
                            <tr key={inst.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-4 py-3 font-medium text-gray-500">{inst.installment_number}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatCurrency(inst.amount_original)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-400">
                                    {(inst.interest_amount + inst.penalty_amount - inst.discount_amount) !== 0 ? (
                                        <span className={((inst.interest_amount + inst.penalty_amount - inst.discount_amount) > 0) ? 'text-red-500' : 'text-green-500'}>
                                            {formatCurrency(inst.interest_amount + inst.penalty_amount - inst.discount_amount)}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-green-600 font-medium">{formatCurrency(inst.amount_paid)}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{formatCurrency(inst.amount_open)}</td>
                                <td className="px-4 py-3 text-center">
                                    {getStatusBadge(inst.status)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <InstallmentPaymentManager
                                        installment={inst}
                                        onUpdate={onRefresh}
                                        trigger={
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
                                                disabled={inst.status === 'PAID'}
                                            >
                                                {inst.status === 'PAID' ? 'Pago' : '+ Pagamento'}
                                            </Button>
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
