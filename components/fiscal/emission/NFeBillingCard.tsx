import { Card, CardContent } from '@/components/ui/Card';
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard';
import { Receipt, Calendar, Calculator, CreditCard, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { PaymentTerm, NFeBilling } from '@/lib/fiscal/nfe-emission-actions';
import { useState, useEffect } from 'react';

interface Props {
    billing: NFeBilling;
    totalAmount: number;
    paymentTerm?: PaymentTerm | null;
    availableTerms?: PaymentTerm[];
    onChange: (billing: NFeBilling) => void;
}

export function NFeBillingCard({ billing, totalAmount, paymentTerm: initialTerm, availableTerms = [], onChange }: Props) {
    const [selectedTermId, setSelectedTermId] = useState<string>(initialTerm?.id || '');

    // Derived effective term ID: prefer selected, fallback to initial
    const effectiveTermId = selectedTermId || initialTerm?.id || '';

    // Derived active term
    const activeTerm = availableTerms.find(t => t.id === effectiveTermId) || initialTerm;

    // ... (handleInstChange, handleAddInstallment, handleDeleteInstallment keep same) ...
    // Note: I will need to use text matching for ReplaceFileContent, so I will be careful.
    // Actually, I'll rewrite the component parts.

    const handleInstChange = (idx: number, field: keyof typeof billing.installments[0], value: any) => {
        const newInstallments = [...billing.installments];
        const current = newInstallments[idx];

        if (field === 'type') {
            if (value === 'HOJE') {
                newInstallments[idx] = {
                    ...current,
                    type: 'HOJE',
                    dueDate: new Date().toISOString().split('T')[0],
                    method: current.method || 'PIX'
                };
            } else {
                newInstallments[idx] = {
                    ...current,
                    type: 'FUTURO',
                    method: 'BOLETO'
                };
            }
        } else {
            newInstallments[idx] = { ...current, [field]: value };
        }
        onChange({ ...billing, installments: newInstallments });
    };

    const handleAddInstallment = () => {
        const newInstallments = [...billing.installments, {
            number: billing.installments.length + 1,
            type: 'FUTURO',
            method: 'BOLETO',
            dueDate: new Date().toISOString().split('T')[0],
            amount: 0
        }];
        onChange({ ...billing, installments: newInstallments as any });
    };

    const handleDeleteInstallment = (idx: number) => {
        const newInstallments = billing.installments.filter((_, i) => i !== idx)
            .map((inst, i) => ({ ...inst, number: i + 1 }));
        onChange({ ...billing, installments: newInstallments });
    };

    const handleGenerate = () => {
        const today = new Date();
        let newInsts: any[] = [];

        if (activeTerm) {
            const count = activeTerm.installments_count || 1;
            const interval = activeTerm.cadence_days || 30;
            const firstDays = activeTerm.first_due_days || 0;
            const amountPerInst = Number((totalAmount / count).toFixed(2));

            // Adjust last installment to match total exactly
            const remainder = Number((totalAmount - (amountPerInst * count)).toFixed(2));

            for (let i = 0; i < count; i++) {
                const daysToAdd = firstDays + (i * interval);
                const date = new Date(today);
                date.setDate(date.getDate() + daysToAdd);
                const dateStr = date.toISOString().split('T')[0];
                const type = daysToAdd === 0 ? 'HOJE' : 'FUTURO';
                const method = daysToAdd === 0 ? 'PIX' : 'BOLETO';

                // Add remainder to first or last? Using last usually.
                let val = amountPerInst;
                if (i === count - 1) val += remainder;

                newInsts.push({
                    number: i + 1,
                    type,
                    method,
                    dueDate: dateStr,
                    amount: val
                });
            }

            // Also update the billing record with the selected term ID
            onChange({
                ...billing,
                paymentTermId: activeTerm.id,
                installments: newInsts
            });

        } else {
            // Fallback: 1 installment 30 days
            const date = new Date(today);
            date.setDate(date.getDate() + 30);
            newInsts = [{
                number: 1,
                type: 'FUTURO',
                method: 'BOLETO',
                dueDate: date.toISOString().split('T')[0],
                amount: totalAmount
            }];
            onChange({ ...billing, installments: newInsts });
        }
    };

    const totalInstallments = billing.installments.reduce((sum, item) => sum + Number(item.amount), 0);
    const diff = totalAmount - totalInstallments;
    const isValid = Math.abs(diff) < 0.05;

    // Header Actions
    const headerActions = (
        <div className="flex items-center gap-4">
            <div className="w-[240px]">
                <Select
                    value={effectiveTermId}
                    onValueChange={(val) => {
                        setSelectedTermId(val);
                        // Optional: Auto-generate on change? Or wait for click?
                        // User prompt implies "Gerar" button is key.
                        // I'll leave it to manual "Gerar" for safety, or auto?
                        // "ele vai servir como base para o botão gerar parcelas" -> suggests waiting for button.
                    }}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o Prazo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableTerms.map(term => (
                            <SelectItem key={term.id} value={term.id}>
                                {term.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="h-8 text-xs bg-white"
                title="Gerar Parcelas conforme Prazo"
            >
                <Calculator className="w-3 h-3 mr-1" />
                Gerar
            </Button>
        </div>
    );

    return (
        <Card>
            <CardHeaderStandard
                title="Fatura / Cobrança"
                description="Defina o pagamento e parcelas"
                icon={<CreditCard className="w-5 h-5 text-gray-500" />}
                actions={headerActions}
                className="py-4"
            />
            <CardContent className="p-0">
                <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Clean Header for larger screens - repeated for grid appearance */}
                    {[1, 2].map(col => (
                        <div key={col} className="hidden md:flex gap-2 text-xs font-medium text-gray-500 pb-2 border-b">
                            <span className="w-8 text-center">Nº</span>
                            <span className="w-[130px]">Vencimento</span>
                            <span className="w-[110px]">Forma</span>
                            <span className="flex-1 text-right">Valor</span>
                            <span className="w-8"></span>
                        </div>
                    ))}

                    {billing.installments.map((inst, idx) => (
                        <div key={idx} className="flex items-center gap-2 py-1">
                            <span className="w-8 text-center font-medium text-sm text-gray-600 shrink-0">
                                {inst.number}
                            </span>

                            {/* Date Input - Now First */}
                            <div className="w-[130px] shrink-0">
                                <Input
                                    type="date"
                                    className="h-8 w-full text-xs px-2"
                                    value={inst.dueDate}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        const today = new Date().toISOString().split('T')[0];
                                        // Infer type: if date <= today -> HOJE, else FUTURO
                                        const newType = newDate <= today ? 'HOJE' : 'FUTURO';

                                        // Update Date and Type
                                        const newInstallments = [...billing.installments];
                                        newInstallments[idx] = {
                                            ...newInstallments[idx],
                                            dueDate: newDate,
                                            type: newType
                                        };
                                        onChange({ ...billing, installments: newInstallments });
                                    }}
                                />
                            </div>

                            {/* Method Select - Now Second */}
                            <div className="w-[110px] shrink-0">
                                <Select
                                    value={inst.method || 'BOLETO'}
                                    onValueChange={(v) => handleInstChange(idx, 'method', v)}
                                >
                                    <SelectTrigger className="h-8 text-xs px-2 truncate">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BOLETO">Boleto</SelectItem>
                                        <SelectItem value="PIX">Pix</SelectItem>
                                        <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                                        <SelectItem value="CARTAO">Cartão</SelectItem>
                                        <SelectItem value="OUTROS">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Value Input - Last (Flex) */}
                            <div className="flex-1 min-w-[80px]">
                                <DecimalInput
                                    precision={2}
                                    className="h-8 w-full text-right text-xs"
                                    value={inst.amount}
                                    onChange={(val) => handleInstChange(idx, 'amount', Number(val))}
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-700 hover:bg-red-50 shrink-0"
                                onClick={() => handleDeleteInstallment(idx)}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between p-4 bg-white border-t border-gray-100">
                    <Button variant="outline" size="sm" onClick={handleAddInstallment} className="h-8 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Adicionar Parcela
                    </Button>

                    {!isValid ? (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                            <Calculator className="w-4 h-4" />
                            <span className="font-medium">Dif: {diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <span className="font-bold">Total OK</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
