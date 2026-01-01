"use client";

import { useEffect, useState, useRef } from "react";
import { SalesOrder } from "@/types/sales";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { getOrganizationById, getPaymentModes, PaymentMode } from "@/lib/clients-db";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";

interface TabProps {
    data: Partial<SalesOrder>;
    onChange: (field: keyof SalesOrder, value: any) => void;
    disabled?: boolean;
}

export function TabGeneral({ data, onChange, disabled }: TabProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const [branches, setBranches] = useState<any[]>([]);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);

    // Track if user manually changed the payment mode to prevent auto-fill override
    const manualPaymentModeOverride = useRef(false);

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

            // Fetch Payment Modes
            getPaymentModes(supabase, selectedCompany.id).then(modes => {
                setPaymentModes(modes);
            }).catch(console.error);
        };
        fetchSettings();
    }, [selectedCompany, supabase]);

    const handlePaymentModeChange = (val: string) => {
        manualPaymentModeOverride.current = true;
        onChange('payment_mode_id', val);
    };

    const handleClientChange = async (org: any) => {
        onChange('client_id', org?.id);

        if (org?.id && selectedCompany) {
            try {
                // Fetch full organization details to get preferred payment mode and addresses
                const fullOrg = await getOrganizationById(supabase, selectedCompany.id, org.id);

                if (fullOrg?.payment_mode_id) {
                    // Update only if user hasn't manually overridden it
                    if (!manualPaymentModeOverride.current) {
                        onChange('payment_mode_id', fullOrg.payment_mode_id);
                    }
                }

                // Auto-fill delivery address
                if (fullOrg.addresses && fullOrg.addresses.length > 0) {
                    const shippingAddr = fullOrg.addresses.find(a => a.type === 'shipping') ||
                        fullOrg.addresses.find(a => a.is_default) ||
                        fullOrg.addresses[0];

                    if (shippingAddr) {
                        const formatted = [
                            shippingAddr.street ? `${shippingAddr.street}${shippingAddr.number ? `, ${shippingAddr.number}` : ""}` : "",
                            shippingAddr.complement ? `(${shippingAddr.complement})` : "",
                            shippingAddr.neighborhood || "",
                            shippingAddr.city ? `${shippingAddr.city} - ${shippingAddr.state || ""}` : "",
                            shippingAddr.zip ? `CEP: ${shippingAddr.zip}` : ""
                        ].filter(Boolean).join(", ");

                        const currentDelivery = data.delivery_address_json || {};
                        onChange('delivery_address_json', {
                            ...currentDelivery,
                            full_address: formatted
                        });
                    }
                }
            } catch (err) {
                console.error("Error fetching client details for auto-fill", err);
            }
        }
    };

    return (
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-6 space-y-1.5">
                <Label>Cliente <span className="text-red-500">*</span></Label>
                <OrganizationSelector
                    value={data.client_id}
                    onChange={handleClientChange}
                    type="customer"
                    disabled={disabled}
                />
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Filial Emitente <span className="text-red-500">*</span></Label>
                <Select
                    value={data.delivery_address_json?.issuer_branch_id || ''}
                    onValueChange={(value) => {
                        const current = data.delivery_address_json || {};
                        onChange('delivery_address_json', { ...current, issuer_branch_id: value });
                    }}
                    disabled={disabled}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione a Filial..." />
                    </SelectTrigger>
                    <SelectContent>
                        {branches.map((b: any, idx) => (
                            <SelectItem key={b.id || idx} value={b.id || b.name}>
                                {b.name} - {b.city}/{b.state}
                            </SelectItem>
                        ))}
                        {branches.length === 0 && <SelectItem value="matriz">Matriz (Padrão)</SelectItem>}
                    </SelectContent>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Vendedor / Responsável</Label>
                <Select
                    value={data.sales_rep_id || ''}
                    onValueChange={(value) => onChange('sales_rep_id', value)}
                    disabled={disabled}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user-1">Usuário Atual (Mock)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Tabela de Preço</Label>
                <Select
                    value={data.price_table_id || ''}
                    onValueChange={(value) => onChange('price_table_id', value)}
                    disabled={disabled}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Padrão do Cliente" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="tab-1">Tabela Varejo</SelectItem>
                        <SelectItem value="tab-2">Tabela Atacado</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-3 space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select
                    value={data.payment_mode_id || ''}
                    onValueChange={handlePaymentModeChange}
                    disabled={disabled}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                        {paymentModes.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                                {mode.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="col-span-12 md:col-span-6 space-y-1.5">
                <Label>Observações Internas (Não sai no Pedido)</Label>
                <Textarea
                    value={data.internal_notes || ''}
                    onChange={(e) => onChange('internal_notes', e.target.value)}
                    className="h-24 resize-none"
                    placeholder="Anotações para a equipe..."
                    disabled={disabled}
                />
            </div>

            <div className="col-span-12 md:col-span-6 space-y-1.5">
                <Label>Observações para o Cliente (Sai no PDF)</Label>
                <Textarea
                    value={data.client_notes || ''}
                    onChange={(e) => onChange('client_notes', e.target.value)}
                    className="h-24 resize-none"
                    placeholder="Instruções de entrega, agradecimentos..."
                    disabled={disabled}
                />
            </div>
        </div>
    );
}
