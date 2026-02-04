"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { useCompany } from '@/contexts/CompanyContext';
import { DealStage, ACTIVE_STAGES, getStageLabel, getStageColor } from '@/lib/deals';
import { DealCard } from './DealCard';
import { cn } from '@/lib/utils';

interface Deal {
    id: string;
    title: string;
    value: number | null;
    stage: DealStage;
    organization?: {
        trade_name: string;
    };
}

export function PipelineKanban() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDeals();
    }, [selectedCompany]);

    async function fetchDeals() {
        if (!selectedCompany) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('crm_deals')
                .select(`
          id,
          title,
          value,
          stage,
          organization:organizations(trade_name)
        `)
                .eq('company_id', selectedCompany.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setDeals(
                (data || []).map((d: any) => ({
                    ...d,
                    organization: Array.isArray(d.organization) ? d.organization[0] : d.organization,
                }))
            );
        } catch (error) {
            console.error('Error fetching deals:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function updateDealStage(dealId: string, newStage: DealStage) {
        try {
            const { error } = await supabase
                .from('crm_deals')
                .update({ stage: newStage })
                .eq('id', dealId);

            if (error) throw error;

            // Optimistic update
            setDeals((prev) =>
                prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
            );
        } catch (error) {
            console.error('Error updating deal stage:', error);
        }
    }

    function getDealsByStage(stage: DealStage) {
        return deals.filter((d) => d.stage === stage);
    }

    if (isLoading) {
        return <div className="p-8 text-center">Carregando pipeline...</div>;
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {ACTIVE_STAGES.map((stage) => {
                const stageDeals = getDealsByStage(stage);
                const colors = getStageColor(stage);

                return (
                    <div
                        key={stage}
                        className="flex-shrink-0 w-80 bg-gray-50 rounded-2xl p-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={cn('font-semibold text-sm', colors.text)}>
                                {getStageLabel(stage)}
                            </h3>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                                {stageDeals.length}
                            </span>
                        </div>

                        <div className="space-y-3 min-h-52">
                            {stageDeals.map((deal) => (
                                <DealCard
                                    key={deal.id}
                                    deal={deal}
                                    onClick={() => router.push(`/app/crm/${deal.id}`)}
                                />
                            ))}
                            {stageDeals.length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-8">
                                    Nenhum negócio
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
