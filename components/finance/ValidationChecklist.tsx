/**
 * Validation Checklist Component
 * Displays pendencies with auto-fix options
 */

'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { type ValidationPendency } from '@/lib/finance/events-db';

interface ValidationChecklistProps {
    pendencies: ValidationPendency[];
    onAutoFix?: (key: string) => void;
    isProcessing?: boolean;
}

export function ValidationChecklist({ pendencies, onAutoFix, isProcessing }: ValidationChecklistProps) {
    const errors = pendencies.filter(p => p.severity === 'error');
    const warnings = pendencies.filter(p => p.severity === 'warning');

    if (pendencies.length === 0) {
        return (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-900">
                    Tudo certo! Evento pronto para aprovação.
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900">Pendências Detectadas</h3>
            </div>

            {errors.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
                        ⛔ Bloqueadores ({errors.length})
                    </p>
                    {errors.map((pendency, idx) => (
                        <div
                            key={`error-${idx}`}
                            className="flex items-start justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                        >
                            <div className="flex-1">
                                <Badge variant="destructive" className="mb-2 text-[10px]">
                                    ERRO
                                </Badge>
                                <p className="text-sm text-red-900">{pendency.message}</p>
                            </div>

                            {pendency.canAutoFix && onAutoFix && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onAutoFix(pendency.key)}
                                    disabled={isProcessing}
                                    className="shrink-0 text-red-700 border-red-300 hover:bg-red-100"
                                >
                                    <Wrench className="w-3.5 h-3.5 mr-1.5" />
                                    Corrigir
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                        ⚠️ Avisos ({warnings.length})
                    </p>
                    {warnings.map((pendency, idx) => (
                        <div
                            key={`warning-${idx}`}
                            className="flex items-start justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                        >
                            <div className="flex-1">
                                <Badge className="mb-2 bg-amber-100 text-amber-800 text-[10px]">
                                    AVISO
                                </Badge>
                                <p className="text-sm text-amber-900">{pendency.message}</p>
                            </div>

                            {pendency.canAutoFix && onAutoFix && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onAutoFix(pendency.key)}
                                    disabled={isProcessing}
                                    className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
                                >
                                    <Wrench className="w-3.5 h-3.5 mr-1.5" />
                                    Corrigir
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
