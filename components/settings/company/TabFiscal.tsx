"use client";

import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CompanySettings } from "@/lib/data/company-settings";
import { FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useState } from "react";
import { NumberingAdjustmentModal } from "@/components/settings/NumberingAdjustmentModal";

interface TabFiscalProps {
    data: Partial<CompanySettings>;
    onChange: (field: keyof CompanySettings, value: any) => void;
    isAdmin: boolean;
}

export function TabFiscal({ data, onChange, isAdmin }: TabFiscalProps) {
    const [showAdjustModal, setShowAdjustModal] = useState(false);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        Configuração Fiscal (NF-e)
                    </CardTitle>
                </CardHeader>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Modelo do Documento</label>
                        <Input
                            value="55 – NF-e"
                            disabled={true}
                            className="bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Ambiente NF-e</label>
                        <div className="flex items-center gap-2">
                            <Select
                                value={data.nfe_environment || 'homologation'}
                                onValueChange={v => onChange('nfe_environment', v)}
                                disabled={!isAdmin}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="homologation">Homologação (Teste)</SelectItem>
                                    <SelectItem value="production">Produção</SelectItem>
                                </SelectContent>
                            </Select>
                            {data.nfe_environment === 'production' && (
                                <Badge variant="destructive" className="whitespace-nowrap">PRODUÇÃO</Badge>
                            )}
                            {(data.nfe_environment === 'homologation' || !data.nfe_environment) && (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 whitespace-nowrap">TESTES</Badge>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-500">
                            Ao alterar o ambiente, a numeração pode ser reiniciada ou ajustada.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Série Padrão <span className="text-red-500">*</span></label>
                        <Input
                            value={data.nfe_series || ''}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').substring(0, 3);
                                onChange('nfe_series', val);
                            }}
                            disabled={!isAdmin}
                            placeholder="1"
                        />
                        <p className="text-[11px] text-gray-500">Apenas números (1-3 dígitos).</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Próximo Número NF-e</label>
                        <div className="flex gap-2">
                            <Input
                                value={data.nfe_next_number || 1}
                                disabled={true}
                                className="bg-gray-50 text-gray-500"
                            />
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setShowAdjustModal(true)}
                                    title="Ajustar Numeração"
                                >
                                    <Settings className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-500">
                            Para alterar, utilize o botão de ajuste (requer justificativa).
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Código Município (IBGE)</label>
                        <Input
                            value={data.city_code_ibge || ''}
                            onChange={e => onChange('city_code_ibge', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="Automático pelo endereço"
                            readOnly // Assuming auto-calculated mostly, but editable if manual? Plan said "block saving if empty", usually auto. User requested "Auto-calculation ... Save as city_code_ibge". Let's keep editable but primarily auto.
                        />
                        <p className="text-[11px] text-gray-500">Preenchido automaticamente pelo CEP/Cidade.</p>
                    </div>

                    {/* Future: Flags/Parametrizações */}
                    <div className="col-span-full">
                        <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-100">
                            Novos campos de parametrização fiscal serão adicionados aqui conforme a integração com o módulo emissor for desenvolvida.
                        </div>
                    </div>

                </div>
            </div>

            <NumberingAdjustmentModal
                open={showAdjustModal}
                onOpenChange={setShowAdjustModal}
                currentNumber={data.nfe_next_number || 1}
                onSuccess={(newNum) => onChange('nfe_next_number', newNum)}
            />
        </div>
    );
}
