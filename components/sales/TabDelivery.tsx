
"use client";

import { SalesOrder } from "@/types/sales";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";

interface TabProps {
    data: Partial<SalesOrder>;
    onChange: (field: keyof SalesOrder, value: any) => void;
}

export function TabDelivery({ data, onChange }: TabProps) {
    return (
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-4 space-y-1.5">
                <Label>Transportadora</Label>
                <OrganizationSelector
                    value={data.carrier_id || ''}
                    onChange={(org) => onChange('carrier_id', org?.id)}
                    type="all"
                />
            </div>

            <div className="col-span-12 md:col-span-4 space-y-1.5">
                <Label>Data de Entrega / Previsão</Label>
                <Input
                    type="date"
                    value={data.delivery_date || ''}
                    onChange={(e) => onChange('delivery_date', e.target.value)}
                />
            </div>

            <div className="col-span-12 md:col-span-4 space-y-1.5">
                <Label>Status Logístico</Label>
                <Select
                    value={data.status_logistic}
                    onChange={(e) => onChange('status_logistic', e.target.value)}
                >
                    <option value="pending">Pendente</option>
                    <option value="separation">Em Separação</option>
                    <option value="expedition">Expedição</option>
                    <option value="delivered">Entregue</option>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-8 space-y-1.5">
                <Label>Endereço Completo</Label>
                <Textarea
                    className="h-24 resize-none"
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    value={data.delivery_address_json?.full_address || ''}
                    onChange={(e) => {
                        const current = data.delivery_address_json || {};
                        onChange('delivery_address_json', { ...current, full_address: e.target.value });
                    }}
                />
                <p className="text-xs text-gray-500 text-right cursor-pointer hover:underline text-brand-600">
                    Copiar do Cadastro do Cliente
                </p>
            </div>

            <div className="col-span-12 md:col-span-4 space-y-1.5">
                <Label>Observações de Entrega</Label>
                <Textarea
                    className="h-24 resize-none"
                    placeholder="Ex: Receber apenas em horário comercial..."
                    value={data.delivery_address_json?.notes || ''}
                    onChange={(e) => {
                        const current = data.delivery_address_json || {};
                        onChange('delivery_address_json', { ...current, notes: e.target.value });
                    }}
                />
            </div>
        </div>
    );
}
