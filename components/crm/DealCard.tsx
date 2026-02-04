import { DealStage, getStageColor, formatCurrency } from '@/lib/deals';
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

interface DealCardProps {
    deal: Deal;
    onClick?: () => void;
}

export function DealCard({ deal, onClick }: DealCardProps) {
    const colors = getStageColor(deal.stage);

    return (
        <div
            onClick={onClick}
            className={cn(
                'p-3 bg-white rounded-2xl border shadow-card cursor-pointer hover:shadow-float transition-shadow',
                colors.border
            )}
        >
            <h4 className="font-medium text-sm text-gray-900 mb-1">{deal.title}</h4>
            {deal.organization && (
                <p className="text-xs text-gray-600 mb-2">{deal.organization.trade_name}</p>
            )}
            {deal.value != null && (
                <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(deal.value)}
                </p>
            )}
        </div>
    );
}
