"use client";

import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CompanySettings } from "@/lib/data/company-settings";
import { FileText } from "lucide-react";

interface TabFiscalProps {
    data: Partial<CompanySettings>;
    onChange: (field: keyof CompanySettings, value: any) => void;
    isAdmin: boolean;
}

export function TabFiscal({ data, onChange, isAdmin }: TabFiscalProps) {
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
                        <label className="text-sm font-medium text-gray-700">Ambiente NF-e</label>
                        <Select
                            value={data.nfe_environment || 'homologation'}
                            onValueChange={v => onChange('nfe_environment', v)}
                            disabled={!isAdmin}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="homologation">Homologação (Teste)</SelectItem>
                                <SelectItem value="production">Produção</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Série Padrão</label>
                        <Input
                            value={data.nfe_series || ''}
                            onChange={e => onChange('nfe_series', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="1"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Próximo Número NF-e</label>
                        <Input
                            type="number"
                            value={data.nfe_next_number || 1}
                            onChange={e => onChange('nfe_next_number', parseInt(e.target.value))}
                            disabled={!isAdmin}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Código Município (IBGE)</label>
                        <Input
                            value={data.city_code_ibge || ''}
                            onChange={e => onChange('city_code_ibge', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="Automático pelo endereço"
                        />
                    </div>

                    {/* Future: Flags/Parametrizações */}
                    <div className="col-span-full">
                        <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-100">
                            Novos campos de parametrização fiscal serão adicionados aqui conforme a integração com o módulo emissor for desenvolvida.
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
