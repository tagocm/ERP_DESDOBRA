
"use client";

import { type EventInstallment } from "@/lib/finance/events-db";
import { type GLAccountOption, type CostCenterOption } from "@/app/actions/finance-events";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Split, Trash2 } from "lucide-react";

interface InstallmentDetailPanelProps {
    installment: EventInstallment;
    isEditing: boolean;
    onChange: (updated: EventInstallment) => void;
    glAccounts?: GLAccountOption[];
    costCenters?: CostCenterOption[];
}

export function InstallmentDetailPanel({ installment, isEditing, onChange, glAccounts = [], costCenters = [] }: InstallmentDetailPanelProps) {
    const handleChange = (field: keyof EventInstallment, value: any) => {
        onChange({ ...installment, [field]: value });
    };

    return (
        <Card className="bg-gray-50 border-t-0 animate-in slide-in-from-top-2 duration-300">
            <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Vencimento */}
                <div>
                    <Label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wide">Vencimento</Label>
                    <Input
                        type="date"
                        value={installment.due_date ? new Date(installment.due_date).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleChange('due_date', e.target.value)}
                        disabled={!isEditing}
                        className="bg-white h-8 text-xs"
                    />
                </div>

                {/* Valor */}
                <div>
                    <Label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wide">Valor (R$)</Label>
                    <Input
                        type="number"
                        value={installment.amount}
                        onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                        disabled={!isEditing}
                        className="bg-white font-mono h-8 text-xs"
                        step="0.01"
                    />
                </div>

                {/* Forma de Pagamento */}
                <div>
                    <Label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wide">Forma Pagto</Label>
                    <Select
                        value={installment.payment_method || ''}
                        onValueChange={(v) => handleChange('payment_method', v)}
                        disabled={!isEditing}
                    >
                        <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Conta (GL Account) */}
                <div>
                    <Label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wide">Conta Financeira</Label>
                    <Select
                        value={installment.suggested_account_id || 'none'}
                        onValueChange={(v) => handleChange('suggested_account_id', v === 'none' ? null : v)}
                        disabled={!isEditing}
                    >
                        <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {glAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Centro de Custo */}
                <div>
                    <Label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wide">Centro de Custo</Label>
                    <Select
                        value={installment.cost_center_id || 'none'}
                        onValueChange={(v) => handleChange('cost_center_id', v === 'none' ? null : v)}
                        disabled={!isEditing}
                    >
                        <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {costCenters.map(cc => (
                                <SelectItem key={cc.id} value={cc.id}>{cc.code ? `${cc.code} - ` : ''}{cc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Observações */}
                <div className="md:col-span-2 lg:col-span-4">
                    <Label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wide">Observações</Label>
                    <Input
                        value={installment.notes || ''}
                        onChange={e => handleChange('notes', e.target.value)}
                        disabled={!isEditing}
                        className="h-8 text-xs bg-white"
                        placeholder="Observações adicionais..."
                    />
                </div>
                </div>

                {isEditing && (
                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-dashed border-gray-200">
                        <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                            <Trash2 className="w-3 h-3 mr-1.5" />
                            Excluir
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200">
                            <Split className="w-3 h-3 mr-1.5" />
                            Dividir
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
