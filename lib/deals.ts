// CRM Deal management utilities

export type DealStage = 'lead' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost';

export const STAGE_LABELS: Record<DealStage, string> = {
    lead: 'Lead',
    qualification: 'Qualificação',
    proposal: 'Proposta',
    negotiation: 'Negociação',
    won: 'Ganho',
    lost: 'Perdido',
};

export const STAGE_COLORS: Record<DealStage, { bg: string; text: string; border: string }> = {
    lead: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300',
    },
    qualification: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
    },
    proposal: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
    },
    negotiation: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
    },
    won: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-300',
    },
    lost: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
    },
};

export function getStageLabel(stage: DealStage): string {
    return STAGE_LABELS[stage] || stage;
}

export function getStageColor(stage: DealStage) {
    return STAGE_COLORS[stage] || STAGE_COLORS.lead;
}

export const ACTIVE_STAGES: DealStage[] = [
    'lead',
    'qualification',
    'proposal',
    'negotiation',
];

export const FINAL_STAGES: DealStage[] = ['won', 'lost'];

export const ALL_STAGES: DealStage[] = [...ACTIVE_STAGES, ...FINAL_STAGES];

export function getNextStage(currentStage: DealStage): DealStage | null {
    const index = ACTIVE_STAGES.indexOf(currentStage);
    if (index === -1 || index === ACTIVE_STAGES.length - 1) return null;
    return ACTIVE_STAGES[index + 1];
}

export function formatCurrency(value: number | null | undefined): string {
    if (value == null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}
