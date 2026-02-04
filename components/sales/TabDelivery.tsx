
import { SalesOrder } from "@/types/sales";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { CarrierSelector } from "@/components/app/CarrierSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Badge } from "@/components/ui/Badge";
import { Truck, MapPin, Package, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";
import { getOrganizationById } from "@/lib/clients-db";
import { useState } from "react";


import { AlertCircle } from "lucide-react";

interface TabProps {
    data: Partial<SalesOrder>;
    onChange: (field: keyof SalesOrder, value: any) => void;
    disabled?: boolean;
    useDeliveriesModel?: boolean;
}

export function TabDelivery({ data, onChange, disabled, useDeliveriesModel }: TabProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const [copying, setCopying] = useState(false);

    const handleCopyFromClient = async () => {
        if (!data.client_id || !selectedCompany) return;

        setCopying(true);
        try {
            const fullOrg = await getOrganizationById(supabase, selectedCompany.id, data.client_id);
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
            console.error("Error copying address:", err);
        } finally {
            setCopying(false);
        }
    };

    const handleModeChange = (val: string) => {
        onChange('freight_mode', val);

        // C) Behavior by Type
        if (val === 'exw') { // RETIRA
            onChange('carrier_id', null);
            onChange('freight_amount', 0);
        } else if (val === 'own_delivery') { // ENTREGA PRÓPRIA
            onChange('carrier_id', null);
            // Freight optional
        }
    };

    const isCarrierDisabled = disabled || data.freight_mode === 'exw' || data.freight_mode === 'own_delivery' || data.freight_mode === 'none';
    const isFreightDisabled = disabled || data.freight_mode === 'exw' || data.freight_mode === 'none';

    return (
        <div className="space-y-6">

            {useDeliveriesModel && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-800 text-sm">Modo de Entregas Ativo</h4>
                        <p className="text-blue-700 text-sm mt-1">
                            Este pedido utiliza o novo modelo de entregas. O agendamento e a gestão de rotas são feitos através do painel de Entregas.
                            As informações abaixo são para fins de cadastro base e NF-e.
                        </p>
                    </div>
                </div>
            )}

            {/* CARD FRETE / LOGÍSTICA */}
            <Card className="bg-white shadow-card border-gray-200">
                <CardHeader className="pag-4 pb-2 border-b border-gray-50 bg-gray-50/50">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                        <Truck className="w-4 h-4" /> Frete / Logística
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-12 gap-4">

                    {/* Linha 1 */}
                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                        <Label>Tipo de Frete <span className="text-red-500">*</span></Label>
                        <Select value={data.freight_mode || 'none'} onValueChange={handleModeChange} disabled={disabled}>
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cif">CIF (Pago pelo Remetente)</SelectItem>
                                <SelectItem value="fob">FOB (Pago pelo Destinatário)</SelectItem>
                                <SelectItem value="exw">Retira (Cliente retira)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                        <Label className={isCarrierDisabled ? "text-gray-400" : ""}>Transportadora</Label>
                        <CarrierSelector
                            value={data.carrier_id || null}
                            onChange={(id) => onChange('carrier_id', id)}
                            disabled={isCarrierDisabled}
                            placeholder="Selecione a transportadora..."
                        />
                    </div>

                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                        <Label className={useDeliveriesModel ? "text-gray-400" : ""}>Região {useDeliveriesModel && "(Legado)"}</Label>
                        <div className="relative">
                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                value={data.route_tag || ''}
                                onChange={(e) => onChange('route_tag', e.target.value)}
                                placeholder="Ex: Zona Sul, Rota 1..."
                                className="pl-9 bg-white"
                                maxLength={40}
                                disabled={disabled} // Maybe disable if model is active? User didn't strictly say disable, but "hide or mark". I marked label.
                            />
                        </div>
                    </div>

                    {/* Linha 2 */}
                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                        <Label className={isFreightDisabled ? "text-gray-400" : ""}>Valor do Frete (R$)</Label>
                        <DecimalInput
                            value={data.freight_amount || 0}
                            onChange={(val) => onChange('freight_amount', val)}
                            disabled={isFreightDisabled}
                            prefix="R$ "
                            className={`bg-white ${isFreightDisabled ? "bg-gray-100" : ""}`}
                            min={0}
                        />
                    </div>

                    <div className="col-span-12 md:col-span-8 space-y-1.5">
                        <Label>Observações (Entrega/Coleta)</Label>
                        <Textarea
                            value={data.shipping_notes || ''}
                            onChange={(e) => onChange('shipping_notes', e.target.value)}
                            placeholder="Instruções para motorista, horários, restrições..."
                            className="h-10 min-h-10 resize-none py-2 leading-tight bg-white"
                            disabled={disabled}
                        />
                        {/* Start small (1 line equiv) but expandable? Or just fix height. User said 'textarea curta'. */}
                    </div>

                </CardContent>
            </Card>

            {/* VOLUMES (Existing) */}
            <Card className="border-dashed border-gray-200 bg-gray-50/50">
                <CardHeader className="pag-4 pb-2">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Volumes e Pesos (NF-e)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 grid grid-cols-12 gap-4">
                    <div className="col-span-6 md:col-span-2 space-y-1.5">
                        <Label>Quantidade</Label>
                        <Input
                            type="number"
                            className="bg-white"
                            value={data.volumes_qty || ''}
                            onChange={(e) => onChange('volumes_qty', Number(e.target.value))}
                            disabled={disabled}
                        />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1.5">
                        <Label>Espécie</Label>
                        <Input
                            placeholder="Ex: CAIXA"
                            className="bg-white"
                            value={data.volumes_species || ''}
                            onChange={(e) => onChange('volumes_species', e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1.5">
                        <Label>Marca</Label>
                        <Input
                            placeholder="Ex: DIVERSOS"
                            className="bg-white"
                            value={data.volumes_brand || ''}
                            onChange={(e) => onChange('volumes_brand', e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                    <div className="col-span-6 md:col-span-3 space-y-1.5">
                        <Label>Peso Líquido (kg)</Label>
                        <DecimalInput
                            value={data.total_weight_kg || 0}
                            onChange={() => { }}
                            disabled
                            className="bg-gray-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500">Calculado automaticamente</p>
                    </div>
                    <div className="col-span-6 md:col-span-3 space-y-1.5">
                        <Label>Peso Bruto (kg)</Label>
                        <DecimalInput
                            value={data.total_gross_weight_kg || 0}
                            onChange={() => { }}
                            disabled
                            className="bg-gray-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500">Calculado automaticamente</p>
                    </div>
                </CardContent>
            </Card>

            {/* ADDRESS SECTION */}
            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                    <Label className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Previsão de Entrega
                    </Label>
                    <div className="relative">
                        <Input
                            type="text"
                            value={data.scheduled_delivery_date ? new Date(data.scheduled_delivery_date).toLocaleDateString('pt-BR') : ''}
                            disabled
                            placeholder="Definido pela rota"
                            className="bg-gray-50 cursor-not-allowed"
                        />
                        {data.delivered_at && (
                            <div className="absolute right-2 top-2">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                        )}
                    </div>
                    {!data.scheduled_delivery_date && (
                        <p className="text-xs text-gray-500">Roteirize o pedido para definir a previsão</p>
                    )}
                    {data.delivered_at && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Entregue em {new Date(data.delivered_at).toLocaleString('pt-BR')}
                        </p>
                    )}
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
                        disabled={disabled}
                    />
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] text-gray-400">Endereço de entrega para impressão.</p>
                        <button
                            type="button"
                            onClick={handleCopyFromClient}
                            disabled={disabled || copying || !data.client_id}
                            className="text-xs text-brand-600 hover:underline disabled:text-gray-400 disabled:no-underline flex items-center gap-1"
                        >
                            {copying && <Loader2 className="w-3 h-3 animate-spin" />}
                            Copiar do Cadastro do Cliente
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
