"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DealStage, ALL_STAGES, getStageLabel, formatCurrency } from '@/lib/deals';
import { ArrowLeft, Trash2 } from 'lucide-react';

interface Deal {
    id: string;
    title: string;
    value: number | null;
    stage: DealStage;
    source: string | null;
    notes: string | null;
    organization_id: string;
    organization?: {
        trade_name: string;
    };
}

export default function DealDetailPage() {
    const params = useParams();
    const dealId = params.dealId as string;
    const router = useRouter();
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [deal, setDeal] = useState<Deal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (dealId && dealId !== 'new') {
            fetchDeal();
        } else {
            setIsLoading(false);
        }
    }, [dealId, selectedCompany]);

    async function fetchDeal() {
        if (!selectedCompany) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('crm_deals')
                .select(`
          *,
          organization:organizations(trade_name)
        `)
                .eq('id', dealId)
                .eq('company_id', selectedCompany.id)
                .single();

            if (error) throw error;
            setDeal(data as Deal);
        } catch (error) {
            console.error('Error fetching deal:', error);
            router.push('/app/crm');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedCompany || !deal) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('crm_deals')
                .update({
                    title: deal.title,
                    value: deal.value,
                    stage: deal.stage,
                    source: deal.source,
                    notes: deal.notes,
                })
                .eq('id', dealId);

            if (error) throw error;

            router.push('/app/crm');
        } catch (error) {
            console.error('Error saving deal:', error);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!confirm('Tem certeza que deseja excluir este negócio?')) return;

        try {
            const { error } = await supabase
                .from('crm_deals')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', dealId);

            if (error) throw error;

            router.push('/app/crm');
        } catch (error) {
            console.error('Error deleting deal:', error);
        }
    }

    if (isLoading) {
        return <div className="p-8">Carregando...</div>;
    }

    if (!deal) {
        return <div className="p-8">Negócio não encontrado</div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.push('/app/crm')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
            </div>

            <form onSubmit={handleSave}>
                <Card>
                    <CardHeader>
                        <CardTitle>Detalhes do Negócio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Título</label>
                            <Input
                                value={deal.title}
                                onChange={(e) => setDeal({ ...deal, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Valor</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={deal.value || ''}
                                    onChange={(e) =>
                                        setDeal({ ...deal, value: parseFloat(e.target.value) || null })
                                    }
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Estágio</label>
                                <Select
                                    value={deal.stage}
                                    onChange={(e) =>
                                        setDeal({ ...deal, stage: e.target.value as DealStage })
                                    }
                                >
                                    {ALL_STAGES.map((stage) => (
                                        <option key={stage} value={stage}>
                                            {getStageLabel(stage)}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Origem</label>
                            <Input
                                value={deal.source || ''}
                                onChange={(e) => setDeal({ ...deal, source: e.target.value })}
                                placeholder="Ex: Indicação, Site, LinkedIn"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notas</label>
                            <textarea
                                className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={deal.notes || ''}
                                onChange={(e) => setDeal({ ...deal, notes: e.target.value })}
                                placeholder="Observações sobre este negócio..."
                            />
                        </div>

                        <div className="flex justify-between pt-4 border-t">
                            <Button
                                type="button"
                                variant="danger"
                                onClick={handleDelete}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
