"use client";

import { useState } from "react";
import { ArInstallment } from "@/types/financial";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, cn, toTitleCase } from "@/lib/utils";
import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AccountsInstallmentRowExpanded } from "./AccountsInstallmentRowExpanded";
import { Checkbox } from "@/components/ui/Checkbox";

export interface GroupedOrder {
    id: string; // Title ID
    document_number: number; // Order/Title Number
    organization_name: string;
    issue_date?: string;
    amount_total: number;
    amount_paid: number;
    amount_open: number;
    next_due_date?: string;
    status: 'OPEN' | 'PARTIAL' | 'PAID';
    installments: ArInstallment[];
}

interface AccountsGroupRowProps {
    group: GroupedOrder;
    selectedIds: Set<string>;
    onToggleGroup: (ids: string[], checked: boolean) => void;
    onToggleInstallment: (id: string, checked: boolean) => void;
    onRefresh: () => void;
}

export function AccountsGroupRow({ group, selectedIds, onToggleGroup, onToggleInstallment, onRefresh }: AccountsGroupRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedInstallmentId, setExpandedInstallmentId] = useState<string | null>(null);

    const toggleInstallment = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedInstallmentId(prev => prev === id ? null : id);
    };

    // Selection Logic
    // We only select/deselect the installments present in this group (filtered ones)
    const groupInstallmentIds = group.installments.map(i => i.id);
    const selectedCount = groupInstallmentIds.filter(id => selectedIds.has(id)).length;
    const isAllSelected = groupInstallmentIds.length > 0 && selectedCount === groupInstallmentIds.length;
    const isIndeterminate = selectedCount > 0 && selectedCount < groupInstallmentIds.length;

    const handleGroupCheckboxChange = (checked: boolean) => {
        onToggleGroup(groupInstallmentIds, checked);
    };

    const getGroupStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">Em Aberto</Badge>;
            case 'PARTIAL': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Parcial</Badge>;
            case 'PAID': return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Pago</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getInstallmentStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">Aberta</Badge>;
            case 'PARTIAL': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Parcial</Badge>;
            case 'PAID': return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Paga</Badge>;
            case 'OVERDUE': return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Vencida</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <>
            {/* Group Header Row */}
            <TableRow
                className={cn("cursor-pointer border-l-4 transition-colors",
                    isExpanded ? "bg-gray-50 border-l-blue-500" : "hover:bg-gray-50 border-l-transparent",
                    selectedCount > 0 && !isExpanded ? "bg-blue-50/20" : ""
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <TableCell>
                    <ChevronDown className={cn("w-4 h-4 transition-transform text-gray-400", isExpanded && "rotate-180 text-blue-600")} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                        onCheckedChange={handleGroupCheckboxChange}
                        className="translate-y-[2px]"
                    />
                </TableCell>
                <TableCell className="font-bold text-gray-900">
                    Pedido #{group.document_number}
                </TableCell>
                <TableCell>
                    <span className="font-medium text-gray-700 truncate block max-w-[250px]">
                        {toTitleCase(group.organization_name)}
                    </span>
                </TableCell>
                <TableCell className="text-gray-500">
                    {group.issue_date ? new Date(group.issue_date).toLocaleDateString('pt-BR') : '-'}
                </TableCell>
                <TableCell className="font-bold text-gray-900">{formatCurrency(group.amount_total)}</TableCell>
                <TableCell className="text-green-600 font-medium">{formatCurrency(group.amount_paid)}</TableCell>
                <TableCell className="text-blue-600 font-medium">{formatCurrency(group.amount_open)}</TableCell>
                <TableCell className="text-gray-500">
                    {group.status !== 'PAID' && group.next_due_date
                        ? <span className={cn(new Date(group.next_due_date) < new Date() ? "text-red-600 font-bold" : "")}>
                            {new Date(group.next_due_date).toLocaleDateString('pt-BR')}
                        </span>
                        : '-'
                    }
                </TableCell>
                <TableCell className="text-center">
                    {getGroupStatusBadge(group.status)}
                </TableCell>
            </TableRow>

            {/* Expanded Content: List of Installments */}
            {isExpanded && (
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                    <TableCell colSpan={10} className="p-0 border-none">
                        <div className="pl-12 pr-4 py-4 space-y-2">
                            {/* Inner Table of Installments */}
                            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase font-bold">
                                        <tr>
                                            <th className="px-4 py-2 w-10"></th>
                                            <th className="px-4 py-2 w-10"></th> {/* Checkbox Column */}
                                            <th className="px-4 py-2 text-left">Parcela</th>
                                            <th className="px-4 py-2 text-left">Vencimento</th>
                                            <th className="px-4 py-2 text-left">Valor</th>
                                            <th className="px-4 py-2 text-left">Pago</th>
                                            <th className="px-4 py-2 text-left">Saldo</th>
                                            <th className="px-4 py-2 text-left">Situação</th>
                                            <th className="px-4 py-2 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {group.installments.map(inst => {
                                            const isInstExpanded = expandedInstallmentId === inst.id;
                                            const isSelected = selectedIds.has(inst.id);
                                            return (
                                                <div key={inst.id} className="contents">
                                                    <tr
                                                        className={cn("hover:bg-blue-50/50 transition-colors cursor-pointer",
                                                            isInstExpanded && "bg-blue-50/30",
                                                            isSelected && !isInstExpanded && "bg-blue-50/20"
                                                        )}
                                                        onClick={(e) => toggleInstallment(inst.id, e)}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", isInstExpanded && "rotate-180 text-blue-600")} />
                                                        </td>
                                                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={(checked) => onToggleInstallment(inst.id, checked as boolean)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-900">
                                                            {inst.installment_number}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">
                                                            {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold">{formatCurrency(inst.amount_original)}</td>
                                                        <td className="px-4 py-3 text-green-600">{formatCurrency(inst.amount_paid)}</td>
                                                        <td className="px-4 py-3 text-blue-600">{formatCurrency(inst.amount_open)}</td>
                                                        <td className="px-4 py-3">
                                                            {getInstallmentStatusBadge(inst.status)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-xs font-bold text-blue-600 hover:text-blue-800">
                                                                {isInstExpanded ? 'Fechar' : 'Gerenciar'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {/* Inline Expansion of the Installment */}
                                                    {isInstExpanded && (
                                                        <tr>
                                                            <td colSpan={9} className="p-4 bg-blue-50/10 border-t border-blue-100 shadow-inner">
                                                                <AccountsInstallmentRowExpanded installment={inst} onRefresh={onRefresh} />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
