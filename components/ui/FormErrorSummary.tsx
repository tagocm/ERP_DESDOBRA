"use client";

import { AlertCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface FormErrorSummaryProps {
    errors: string[];
    onClose?: () => void;
    visible?: boolean;
}

export function FormErrorSummary({ errors, onClose, visible }: FormErrorSummaryProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible && errors.length > 0) {
            // Scroll into view logic could go here, or handled by parent.
            // The request says "Give focus/scroll to first invalid field". 
            // The banner itself should probably just appear.
            // We'll leave scroll logic for the helper.
        }
    }, [visible, errors]);

    if (!visible || errors.length === 0) return null;

    return (
        <div
            ref={ref}
            className="mb-4 rounded-md bg-red-50 border border-red-200 p-4 transition-all animate-in slide-in-from-top-2"
        >
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" aria-hidden="true" />
                </div>
                <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">
                        Erro de validação
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                        <p>Corrija os campos destacados.</p>
                        {errors.length > 0 && (
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                {errors.slice(0, 3).map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                                {errors.length > 3 && (
                                    <li>... e mais {errors.length - 3} erros.</li>
                                )}
                            </ul>
                        )}
                    </div>
                </div>
                {onClose && (
                    <div className="ml-auto pl-3">
                        <div className="-mx-1.5 -my-1.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                            >
                                <span className="sr-only">Fechar</span>
                                <X className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
