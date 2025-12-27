
"use client";

import { useEffect, useState } from "react";
import { SalesOrder } from "@/types/sales";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";

interface TabProps {
    data: Partial<SalesOrder>;
    onChange: (field: keyof SalesOrder, value: any) => void;
}

export function TabGeneral({ data, onChange }: TabProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const [branches, setBranches] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedCompany) return;

        const fetchSettings = async () => {
            const { data: settings } = await supabase
                .from('company_settings')
                .select('branches')
                .eq('company_id', selectedCompany.id)
                .single();

            if (settings?.branches) {
                const b = Array.isArray(settings.branches) ? settings.branches : [];
                setBranches(b);
            }
        };
        fetchSettings();
    }, [selectedCompany, supabase]);

    return (
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-6 space-y-1.5">
                <Label>Cliente <span className="text-red-500">*</span></Label>
                <OrganizationSelector
                    value={data.client_id}
                    onChange={(org) => {
                        onChange('client_id', org?.id);
                    }}
                    type="customer"
                />
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Filial Emitente <span className="text-red-500">*</span></Label>
                <Select
                    value={data.delivery_address_json?.issuer_branch_id || ''}
                    onChange={(e) => {
                        const current = data.delivery_address_json || {};
                        onChange('delivery_address_json', { ...current, issuer_branch_id: e.target.value });
                    }}
                >
                    <option value="">Selecione a Filial...</option>
                    {branches.map((b: any, idx) => (
                        <option key={b.id || idx} value={b.id || b.name}>
                            {b.name} - {b.city}/{b.state}
                        </option>
                    ))}
                    {branches.length === 0 && <option value="matriz">Matriz (Padrão)</option>}
                </Select>
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Vendedor / Responsável</Label>
                <Select
                    value={data.sales_rep_id || ''}
                    onChange={(e) => onChange('sales_rep_id', e.target.value)}
                >
                    <option value="">Selecione...</option>
                    <option value="user-1">Usuário Atual (Mock)</option>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Tabela de Preço</Label>
                <Select
                    value={data.price_table_id || ''}
                    onChange={(e) => onChange('price_table_id', e.target.value)}
                >
                    <option value="">Padrão do Cliente</option>
                    <option value="tab-1">Tabela Varejo</option>
                    <option value="tab-2">Tabela Atacado</option>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-6 space-y-1.5">
                <Label>Observações Internas (Não sai no Pedido)</Label>
                <Textarea
                    value={data.internal_notes || ''}
                    onChange={(e) => onChange('internal_notes', e.target.value)}
                    className="h-24 resize-none"
                    placeholder="Anotações para a equipe..."
                />
            </div>

            <div className="col-span-12 md:col-span-6 space-y-1.5">
                <Label>Observações para o Cliente (Sai no PDF)</Label>
                <Textarea
                    value={data.client_notes || ''}
                    onChange={(e) => onChange('client_notes', e.target.value)}
                    className="h-24 resize-none"
                    placeholder="Instruções de entrega, agradecimentos..."
                />
            </div>
        </div>
    );
}
