'use client';

import { Check, X, AlertTriangle } from 'lucide-react';

type OutcomeType = 'ENTREGUE' | 'NAO_ENTREGUE' | 'DEVOLVIDO_PARCIAL';

interface ReturnOutcomeSelectorProps {
    currentOutcome?: OutcomeType;
    onOutcomeSelect: (outcome: OutcomeType) => void;
    disabled?: boolean;
}

export function ReturnOutcomeSelector({
    currentOutcome,
    onOutcomeSelect,
    disabled = false
}: ReturnOutcomeSelectorProps) {
    return (
        <div className="flex flex-col gap-2">
            {/* Green: ENTREGUE */}
            <button
                onClick={() => onOutcomeSelect('ENTREGUE')}
                disabled={disabled}
                title="Entregue"
                className={`w-8 h-8 rounded flex items-center justify-center border transition-all duration-200 ${currentOutcome === 'ENTREGUE'
                    ? 'bg-green-500 border-green-500 shadow-sm'
                    : 'bg-white border-green-200 hover:border-green-400'
                    }`}
            >
                {currentOutcome === 'ENTREGUE' && <Check className="w-5 h-5 text-white" />}
            </button>

            {/* Yellow: DEVOLVIDO PARCIAL */}
            <button
                onClick={() => onOutcomeSelect('DEVOLVIDO_PARCIAL')}
                disabled={disabled}
                title="Devolvido Parcial"
                className={`w-8 h-8 rounded flex items-center justify-center border transition-all duration-200 ${currentOutcome === 'DEVOLVIDO_PARCIAL'
                    ? 'bg-amber-400 border-amber-400 shadow-sm'
                    : 'bg-white border-amber-200 hover:border-amber-400'
                    }`}
            >
                {currentOutcome === 'DEVOLVIDO_PARCIAL' && (
                    <span className="text-white text-xs font-bold leading-none">P</span>
                )}
            </button>

            {/* Red: NÃO ENTREGUE */}
            <button
                onClick={() => onOutcomeSelect('NAO_ENTREGUE')}
                disabled={disabled}
                title="Não Entregue"
                className={`w-8 h-8 rounded flex items-center justify-center border transition-all duration-200 ${currentOutcome === 'NAO_ENTREGUE'
                    ? 'bg-red-500 border-red-500 shadow-sm'
                    : 'bg-white border-red-200 hover:border-red-400'
                    }`}
            >
                {currentOutcome === 'NAO_ENTREGUE' && <X className="w-5 h-5 text-white" />}
            </button>
        </div>
    );
}
