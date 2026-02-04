
"use client";

import { SalesOrder, SalesOrderPayment } from "@/types/sales";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { Trash2, Plus } from "lucide-react";
import { useRef } from "react";

interface TabProps {
    data: Partial<SalesOrder>;
    onChange: (field: keyof SalesOrder, value: any) => void;
    disabled?: boolean;
}

export function TabPayment({ data, onChange, disabled }: TabProps) {
    const payments = data.payments || [];
    const tempIdCounter = useRef(1);

    const handleAddPayment = () => {
        const totalPayments = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const remaining = (data.total_amount || 0) - totalPayments;

        const newPayment: SalesOrderPayment = {
            id: `temp-${tempIdCounter.current++}`,
            document_id: data.id || '',
            installment_number: payments.length + 1,
            due_date: new Date().toISOString().split('T')[0],
            amount: remaining > 0 ? remaining : 0,
            status: 'pending'
        };
        onChange('payments', [...payments, newPayment]);
    };

    const handleRemovePayment = (index: number) => {
        const newPayments = [...payments];
        newPayments.splice(index, 1);
        onChange('payments', newPayments);
    };

    const handleUpdatePayment = (index: number, field: keyof SalesOrderPayment, value: any) => {
        const newPayments = [...payments];
        newPayments[index] = { ...newPayments[index], [field]: value };
        onChange('payments', newPayments);
    };

    const totalScheduled = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const diff = (data.total_amount || 0) - totalScheduled;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-gray-900">Parcelas</h3>
                <div className="text-sm">
                    <span className="text-gray-500 mr-2">Total Pedido:</span>
                    <span className="font-medium mr-4">{data.total_amount?.toFixed(2)}</span>

                    <span className="text-gray-500 mr-2">Agendado:</span>
                    <span className={`font-medium ${Math.abs(diff) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                        {totalScheduled.toFixed(2)}
                    </span>
                    {Math.abs(diff) > 0.01 && <span className="ml-2 text-xs text-red-500">(Diferença: {diff.toFixed(2)})</span>}
                </div>
            </div>

            <div className="border rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-1 text-center">Nº</div>
                    <div className="col-span-3">Vencimento</div>
                    <div className="col-span-3">Valor</div>
                    <div className="col-span-3">Status</div>
                    <div className="col-span-2"></div>
                </div>
                <div className="divide-y">
                    {payments.map((p, index) => (
                        <div key={p.id} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-gray-50">
                            <div className="col-span-1 text-center font-medium">
                                <Input
                                    className="text-center h-8"
                                    value={p.installment_number}
                                    onChange={(e) => handleUpdatePayment(index, 'installment_number', e.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    type="date"
                                    className="h-8"
                                    value={p.due_date}
                                    onChange={(e) => handleUpdatePayment(index, 'due_date', e.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    type="number"
                                    className="h-8 text-right font-medium text-gray-900"
                                    value={p.amount}
                                    onChange={(e) => handleUpdatePayment(index, 'amount', e.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-3">
                                <Select
                                    value={p.status}
                                    onValueChange={(val) => handleUpdatePayment(index, 'status', val)}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="paid">Pago</SelectItem>
                                        <SelectItem value="discounted">Descontado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 flex justify-end">
                                {!disabled && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500"
                                        onClick={() => handleRemovePayment(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    {payments.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">Nenhuma parcela gerada.</div>
                    )}
                </div>
            </div>

            {!disabled && (
                <Button variant="outline" className="border-dashed w-full" onClick={handleAddPayment}>
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Parcela
                </Button>
            )}
        </div>
    );
}
