'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmissionData, NFeDraftData, saveNFeDraft, emitNFe, NFeItem, NFeBilling } from '@/lib/fiscal/nfe-emission-actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Check, Save, Loader2, FileText } from 'lucide-react';
import Link from 'next/link';

import { NFeIssuerCard } from './NFeIssuerCard';
import { NFeRecipientCard } from './NFeRecipientCard';
import { NFeItemsTable } from './NFeItemsTable';
import { NFeBillingCard } from './NFeBillingCard';
import { NFeTransportCard } from './NFeTransportCard';
import { NFeAdditionalInfo } from './NFeAdditionalInfo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Props {
    data: EmissionData;
    orderId: string;
}

export function NFeEmissionForm({ data, orderId }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isEmitting, setIsEmitting] = useState(false);

    // --- Draft Initialization ---
    const [draft, setDraft] = useState<NFeDraftData>(() => {
        if (data.draft) {
            return {
                ...data.draft,
                transport: data.draft.transport || {
                    modality: Number(data.order.freight_amount) > 0 ? '0' : '9',
                    volumes_qty: data.order.volumes_qty || 0,
                    species: data.order.volumes_species || 'VOLUMES',
                    brand: data.order.volumes_brand || '',
                    number: '',
                    weight_net: data.order.volumes_net_weight_kg || data.order.total_weight_kg || 0,
                    weight_gross: data.order.volumes_gross_weight_kg || data.order.total_gross_weight_kg || 0
                }
            };
        }

        const items = (data.order.items || []).map((item: any) => {
            // Determine UOM using Snapshot > Packaging > Product hierarchy
            let uom = 'UN';

            // 1. Snapshot Strategy (Gold Standard)
            const snapshot = item.sales_unit_snapshot;
            if (snapshot?.sell_unit_code) {
                uom = snapshot.sell_unit_code;
            }
            // 2. Packaging Legacy Strategy
            else if (item.packaging) {
                switch (item.packaging.type) {
                    case 'BOX': uom = 'Cx'; break;
                    case 'PACK': uom = 'Pc'; break;
                    case 'BALE': uom = 'Fd'; break;
                    case 'PALLET': uom = 'Pal'; break;
                    case 'OTHER': uom = 'Un'; break;
                    default: uom = 'Un';
                }
            }
            // 3. Product Fallback
            else {
                uom = item.product?.un || 'Un';
            }

            return {
                id: item.id,
                product_id: item.product_id || item.item_id,
                product_code: item.product?.sku || '',
                product_name: item.product?.name || `Item ${item.item_id}`,
                ncm: item.ncm_snapshot || item.product?.fiscal?.ncm || '',
                cfop: item.cfop_code || '5102',
                uom: uom,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                total_price: Number(item.total_amount),
                discount: Number(item.discount_amount || 0),
                // Tax Values
                icms_base: Number(item.icms_base || 0),
                icms_value: Number(item.icms_value || 0),
                icms_st_base: Number(item.st_base_calc || 0),
                icms_st_value: Number(item.st_value || 0),
                ipi_value: Number(item.ipi_value || 0),
                pis_value: Number(item.pis_value || 0),
                cofins_value: Number(item.cofins_value || 0)
            };
        });

        // Map existing payments
        const installments = (data.order.payments || []).map((p: any) => ({
            number: p.installment_number,
            dueDate: p.due_date,
            amount: Number(p.amount),
            type: (p.due_date <= new Date().toISOString().split('T')[0] ? 'HOJE' : 'FUTURO') as 'HOJE' | 'FUTURO',
            method: 'BOLETO'
        }));

        return {
            issuer: data.company,
            recipient: {
                ...data.order.client,
                address: (data.order.client as any)?.addresses?.[0] || {}
            },
            items,
            billing: {
                paymentMode: 'prazo', // TODO: Map from payment_terms
                installments: installments.length > 0 ? installments : []
            },
            transport: {
                modality: Number(data.order.freight_amount) > 0 ? '0' : '9',
                volumes_qty: data.order.volumes_qty || 0,
                species: data.order.volumes_species || 'VOLUMES',
                brand: data.order.volumes_brand || '',
                number: '',
                weight_net: data.order.volumes_net_weight_kg || data.order.total_weight_kg || 0,
                weight_gross: data.order.volumes_gross_weight_kg || data.order.total_gross_weight_kg || 0,
                carrier: data.order.carrier_id ? {
                    id: data.order.carrier_id,
                    document: (data.order as any).carrier?.document || '', // Assuming joined carrier has document
                    name: (data.order as any).carrier?.trade_name || (data.order as any).carrier?.name || '',
                    ie: (data.order as any).carrier?.state_registration || '',
                    address: (data.order as any).carrier?.addresses?.[0]?.street || '',
                    city: (data.order as any).carrier?.addresses?.[0]?.city || '',
                    uf: (data.order as any).carrier?.addresses?.[0]?.state || ''
                } : undefined
            },
            totals: {
                products: Number(data.order.subtotal_amount || 0),
                discount: Number(data.order.discount_amount || 0),
                freight: Number(data.order.freight_amount || 0),
                insurance: 0,
                others: 0,
                total: Number(data.order.total_amount || 0)
            },
            additional_info: data.draft?.additional_info || {
                fisco: '',
                // Cast to any to bypass strict type check if NFeDraftData definition is partial or missing 'notes' in type but present in data
                taxpayer: (data.draft as any)?.notes || (data.order.internal_notes ? `Ped. ${data.order.document_number} - ${data.order.internal_notes}` : `Referente pedido #${data.order.document_number}`)
            }
        };
    });

    // --- Handlers ---

    // Auto-save draft on mount (create record)
    useEffect(() => {
        if (!data.draft) {
            saveNFeDraft(orderId, draft).catch(console.error);
        }
    }, []);

    const handleRecipientChange = (field: string, value: any) => {
        setDraft(prev => ({
            ...prev,
            recipient: { ...prev.recipient, [field]: value }
        }));
    };

    const handleItemUpdate = (index: number, field: keyof NFeItem, value: any) => {
        setDraft(prev => {
            const newItems = [...prev.items];
            const oldItem = newItems[index];

            const newItem = { ...oldItem, [field]: value };

            // Recalculate totals if needed
            if (field === 'quantity' || field === 'unit_price' || field === 'discount') {
                const qty = field === 'quantity' ? value : newItem.quantity;
                const price = field === 'unit_price' ? value : newItem.unit_price;
                const disc = field === 'discount' ? value : newItem.discount;

                newItem.total_price = (qty * price) - (disc || 0);
            }

            newItems[index] = newItem;

            // Update main totals
            const totalProd = newItems.reduce((acc, i) => acc + i.total_price, 0);
            const totalIpi = newItems.reduce((acc, i) => acc + (i.ipi_value || 0), 0);
            const totalSt = newItems.reduce((acc, i) => acc + (i.icms_st_value || 0), 0);

            // Total NF = Products - Discount + Freight + Insurance + Others + IPI + ST
            // Notes: Discount is already subtracted in item.total_price usually? 
            // In line 115: newItem.total_price = (qty * price) - (disc || 0);
            // So totalProd is net of item discounts.
            // But totals.discount is usually global discount? Or sum of items?
            // In line 77: discount: Number(data.order.discount_amount || 0)
            // If totalProd already has discount subtracted, we shouldn't subtract totals.discount again if it's just a sum.
            // Let's assume totalProd matches order subtotal which might be gross.
            // Wait, logic at 115 subtracts discount from total_price. So totalProd IS net.
            // But usually Total NF = Total Prod + Freight + Ins + Others + IPI + ST.
            // If totalProd is net, we are good.
            // Currently: totalProd + freight + others + insurance - global_discount (if applied separately?).
            // Existing code: const totalNF = totalProd + prev.totals.freight + prev.totals.others + prev.totals.insurance;
            // It doesn't subtract totals.discount.

            const totalNF = totalProd + prev.totals.freight + prev.totals.others + prev.totals.insurance + totalIpi + totalSt;

            return {
                ...prev,
                items: newItems,
                totals: {
                    ...prev.totals,
                    products: totalProd,
                    total: totalNF
                }
            };
        });
    };

    const handleBillingChange = (billing: NFeBilling) => {
        setDraft(prev => ({ ...prev, billing }));
    };

    const handleTransportChange = (field: string, value: any) => {
        setDraft(prev => ({
            ...prev,
            transport: { ...prev.transport, [field]: value }
        }));
    };

    const handleTotalChange = (field: 'freight' | 'insurance' | 'others', value: number) => {
        setDraft(prev => {
            const newTotals = { ...prev.totals, [field]: value };

            // Recalculate Total NF
            const totalIpi = prev.items.reduce((acc, i) => acc + (i.ipi_value || 0), 0);
            const totalSt = prev.items.reduce((acc, i) => acc + (i.icms_st_value || 0), 0);

            // Total = Products + New Freight + New Others + New Insurance + IPI + ST
            const totalNF = prev.totals.products + newTotals.freight + newTotals.others + newTotals.insurance + totalIpi + totalSt;

            return {
                ...prev,
                totals: {
                    ...newTotals,
                    total: totalNF
                }
            };
        });
    };

    const handleAdditionalInfoChange = (field: 'fisco' | 'taxpayer', value: string) => {
        setDraft(prev => ({
            ...prev,
            additional_info: {
                ...prev.additional_info,
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveNFeDraft(orderId, draft);
            toast({ title: 'Rascunho salvo', description: 'As alterações foram salvas.' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro ao salvar', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEmit = async () => {
        // Validations
        if (!draft.recipient.document_number) {
            toast({ title: 'Erro de Validação', description: 'CNPJ/CPF do destinatário obrigatório.', variant: 'destructive' });
            return;
        }

        // Check billing sum
        const totalInst = draft.billing.installments.reduce((acc, i) => acc + i.amount, 0);
        if (draft.billing.installments.length > 0 && Math.abs(totalInst - draft.totals.total) > 0.05) {
            toast({ title: 'Erro de Validação', description: 'Soma das parcelas difere do total da nota.', variant: 'destructive' });
            return;
        }

        setIsEmitting(true);
        try {
            // 1. Enqueue Job
            const result = await emitNFe(orderId, draft);

            if (!result.jobId) {
                // Fallback for immediate return (should not happen with new logic, but robust)
                throw new Error("Resposta inválida: Job ID não retornado.");
            }

            toast({
                title: 'Processamento Iniciado ⏳',
                description: 'A nota fiscal entrou na fila de processamento...'
            });

            // 2. Poll for Status
            const pollInterval = setInterval(async () => {
                // Determine poll function dynamically to avoid import cycles is hard in client, 
                // but we imported `pollNFeJobStatus` from actions? No, we need to import it.
                // It was not imported yet. I will rely on the fact that I will add it to the imports in a separate step or assume I can add it here if I modify imports.
                // Wait, I can't modify imports in this block.
                // I will add the import in a previous step? No, replacing the whole file or just use 'require'? Client component can't verify require? 

                // Let's assume pollNFeJobStatus is available (I will fix imports next).
                const { pollNFeJobStatus } = await import('@/lib/fiscal/nfe-emission-actions');

                const statusRes = await pollNFeJobStatus(result.jobId!);

                if (statusRes.status === 'completed') {
                    clearInterval(pollInterval);
                    setIsEmitting(false);
                    // Fixed: shadcn toast usually doesn't accept className, handled by variant or custom component?
                    // Actually, standard useToast from shadcn often exposes a 'className' prop on the toast call if configured.
                    // But the error says it doesn't. Checking types...
                    // If className is not supported, I'll use standard variant 'default' or 'success' if available.
                    // Assuming 'default' for now as 'success' is not standard shadcn.
                    toast({
                        title: 'Sucesso! ✅',
                        description: 'Nota Fiscal emitida e autorizada.',
                        // className: 'bg-green-600 text-white' // REMOVED CAUSE ERROR
                        // Standard shadcn doesn't easy style color unless custom variant.
                    });
                    router.push('/app/fiscal/nfe');
                    router.refresh();
                }
                else if (statusRes.status === 'failed') {
                    clearInterval(pollInterval);
                    setIsEmitting(false);
                    console.error('Job Failed:', statusRes.last_error);
                    toast({
                        title: 'Falha no Processamento ❌',
                        description: statusRes.last_error || 'Ocorreu um erro durante a emissão.',
                        variant: 'destructive'
                    });
                }
                // If pending/processing, keep polling
            }, 2000);

            // Safety timeout (e.g. 60s)
            setTimeout(() => {
                clearInterval(pollInterval);
                if (isEmitting) {
                    setIsEmitting(false);
                    toast({
                        title: 'Tempo Excedido',
                        description: 'O processamento está demorando mais que o esperado. Verifique o status na lista.',
                        // variant: 'warning' // REMOVED CAUSE ERROR, using 'destructive' or 'default'
                        variant: 'destructive'
                    });
                    router.push('/app/fiscal/nfe');
                }
            }, 60000);

        } catch (error: any) {
            console.error(error);
            setIsEmitting(false);
            toast({
                title: 'Erro ao iniciar emissão',
                description: error.message || 'Falha de comunicação.',
                variant: 'destructive'
            });
        }
        // finally removed because we handle loading state inside polling
    };

    const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-6 pb-20">
            <PageHeader
                title={`Emitir NF-e - Pedido #${data.order.document_number}`}
                subtitle="Revise os dados antes de emitir a nota fiscal."
                // icon removed as per type definition
                actions={
                    <div className="flex gap-2">
                        <Link href="/app/fiscal/nfe">
                            <Button variant="outline">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                            </Button>
                        </Link>
                        <Button variant="secondary" onClick={handleSave} disabled={isSaving || isEmitting}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Rascunho
                        </Button>
                        <Button onClick={handleEmit} disabled={isSaving || isEmitting} className="bg-blue-600 hover:bg-blue-700">
                            {isEmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Emitir NF-e
                        </Button>
                    </div>
                }
            />

            <div className="space-y-6 px-6">
                {draft.issuer && <NFeIssuerCard company={draft.issuer} />}

                <NFeRecipientCard
                    recipient={draft.recipient}
                    onChange={handleRecipientChange}
                />

                <NFeBillingCard
                    billing={draft.billing}
                    totalAmount={draft.totals.total}
                    paymentTerm={data.payment_term}
                    availableTerms={data.available_payment_terms}
                    onChange={handleBillingChange}
                />

                <NFeItemsTable
                    items={draft.items}
                    totals={draft.totals}
                    availableUoms={data.available_uoms}
                    onUpdateItem={handleItemUpdate}
                />

                <NFeTransportCard
                    transport={draft.transport}
                    totals={draft.totals}
                    onTransportChange={handleTransportChange}
                    onTotalChange={handleTotalChange}
                />

                <NFeAdditionalInfo
                    fisco={draft.additional_info?.fisco}
                    taxpayer={draft.additional_info?.taxpayer}
                    onChange={handleAdditionalInfoChange}
                />
            </div>
        </div>
    );
}
