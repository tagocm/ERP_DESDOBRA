/**
 * Installments Editor Component
 * Inline editing table for event installments
 */

'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { type EventInstallment } from '@/lib/finance/events-db';
import { formatCurrency } from '@/lib/utils';

export interface BankAccountOption {
    id: string;
    name: string;
}

interface InstallmentsEditorProps {
    installments: EventInstallment[];
    totalAmount: number;
    accounts?: BankAccountOption[];
    onChange: (installments: EventInstallment[]) => void;
    onRecalculate?: () => void;
    readonly?: boolean;
}

export function InstallmentsEditor({
    installments,
    totalAmount,
    accounts = [],
    onChange,
    onRecalculate,
    readonly = false
}: InstallmentsEditorProps) {
    const [editingId, setEditingId] = useState<string | null>(null);

    const sum = installments.reduce((acc, inst) => acc + inst.amount, 0);
    const diff = Math.abs(sum - totalAmount);
    const hasDifference = diff > 0.01;

    const handleUpdate = (id: string, field: keyof EventInstallment, value: any) => {
        const updated = installments.map(inst =>
            inst.id === id ? { ...inst, [field]: value } : inst
        );
        onChange(updated);
    };

    const handleAdd = () => {
        const newInst: EventInstallment = {
            id: `temp-${Date.now()}`,
            event_id: installments[0]?.event_id || '',
            installment_number: installments.length + 1,
            due_date: new Date().toISOString().split('T')[0],
            amount: 0,
            payment_condition: null,
            payment_method: null,
            suggested_account_id: null,
            category_id: null,
            cost_center_id: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        onChange([...installments, newInst]);
    };

    const handleRemove = (id: string) => {
        const filtered = installments.filter(inst => inst.id !== id);
        // Renumber
        const renumbered = filtered.map((inst, idx) => ({
            ...inst,
            installment_number: idx + 1
        }));
        onChange(renumbered);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-900">
                        Parcelas ({installments.length})
                    </h3>

                    {hasDifference && (
                        <Badge variant="destructive" className="text-[10px]">
                            Diferença: {formatCurrency(diff)}
                        </Badge>
                    )}
                </div>

                {!readonly && (
                    <div className="flex gap-2">
                        {onRecalculate && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onRecalculate}
                                className="text-blue-600"
                            >
                                <Calculator className="w-3.5 h-3.5 mr-1.5" />
                                Recalcular
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleAdd}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Adicionar
                        </Button>
                    </div>
                )}
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead className="w-[140px]">Vencimento</TableHead>
                            <TableHead className="w-[140px]">Valor</TableHead>
                            <TableHead>Condição</TableHead>
                            <TableHead>Conta</TableHead>
                            <TableHead className="w-10 text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {installments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                                    Nenhuma parcela definida
                                </TableCell>
                            </TableRow>
                        ) : (
                            installments.map((inst) => (
                                <TableRow key={inst.id} className="group hover:bg-gray-50/50">
                                    <TableCell className="font-mono text-sm text-gray-500 text-center">
                                        {inst.installment_number}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="date"
                                            value={inst.due_date}
                                            onChange={(e) => handleUpdate(inst.id, 'due_date', e.target.value)}
                                            disabled={readonly}
                                            className="h-8 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={inst.amount}
                                            onChange={(e) => handleUpdate(inst.id, 'amount', parseFloat(e.target.value) || 0)}
                                            disabled={readonly}
                                            className="h-8 text-sm font-mono"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="text"
                                            value={inst.payment_condition || ''}
                                            onChange={(e) => handleUpdate(inst.id, 'payment_condition', e.target.value)}
                                            placeholder="Ex: 30 dias"
                                            disabled={readonly}
                                            className="h-8 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={inst.suggested_account_id || undefined}
                                            onValueChange={(val) => handleUpdate(inst.id, 'suggested_account_id', val)}
                                            disabled={readonly}
                                        >
                                            <SelectTrigger className="h-8 text-sm border-gray-200">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!readonly && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleRemove(inst.id)}
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:bg-red-50"
                                                title="Remover parcela"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}

                        {/* Summary Row */}
                        <TableRow className="bg-gray-50 font-bold border-t-2 border-gray-100">
                            <TableCell colSpan={2} className="text-right text-gray-600">Total:</TableCell>
                            <TableCell className={hasDifference ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(sum)}
                            </TableCell>
                            <TableCell colSpan={3} className="text-xs text-gray-500 font-normal pt-3">
                                {hasDifference
                                    ? `Diferença de ${formatCurrency(diff)} em relação ao total do evento`
                                    : 'Total confere com o evento'}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
