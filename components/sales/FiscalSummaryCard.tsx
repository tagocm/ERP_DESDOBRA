"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { SalesOrderItemDTO } from "@/lib/types/sales-dto";

interface FiscalSummaryCardProps {
    items: SalesOrderItemDTO[];
    className?: string;
}

/**
 * Fiscal Summary Card - Discreet, collapsible fiscal data display
 * Shows fiscal calculation status and detailed breakdowns in accordion sub-sections
 */
export function FiscalSummaryCard({ items, className }: FiscalSummaryCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set());

    // Calculate fiscal status summary
    const totalItems = items.length;
    const calculatedItems = items.filter(i => i.fiscal_status === 'calculated').length;
    const pendingItems = items.filter(i => i.fiscal_status === 'pending' || i.fiscal_status === 'no_rule_found').length;
    const isAllCalculated = totalItems > 0 && calculatedItems === totalItems;

    const toggleSection = (section: string) => {
        const newSet = new Set(openSections);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        setOpenSections(newSet);
    };

    if (totalItems === 0) {
        return null; // Don't show if no items
    }

    return (
        <Card className={cn("border-gray-200", className)}>
            {/* Collapsible Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">Fiscal (automático)</span>

                    {/* Status Badge */}
                    {isAllCalculated ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Fiscal OK</span>
                        </div>
                    ) : pendingItems > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Fiscal Pendente ({pendingItems} {pendingItems === 1 ? 'item' : 'itens'})</span>
                        </div>
                    ) : null}
                </div>
            </button>

            {/* Collapsible Content */}
            {isOpen && (
                <CardContent className="pt-0 pb-4 px-4 space-y-2">
                    {/* Sub-Section: Classifications */}
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <button
                            onClick={() => toggleSection('classification')}
                            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                            <span className="text-xs font-medium text-gray-600">Classificação dos Itens</span>
                            {openSections.has('classification') ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            )}
                        </button>
                        {openSections.has('classification') && (
                            <div className="p-3 bg-white">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left pb-2 font-medium text-gray-500">Item</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">NCM</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">CEST</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">Origem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                                <td className="py-2 text-gray-700">{item.product?.name || '-'}</td>
                                                <td className="py-2 text-gray-600">{item.ncm_snapshot || '-'}</td>
                                                <td className="py-2 text-gray-600">{item.cest_snapshot || '-'}</td>
                                                <td className="py-2 text-gray-600">{item.origin_snapshot !== null && item.origin_snapshot !== undefined ? item.origin_snapshot : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Sub-Section: Applied Rules */}
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <button
                            onClick={() => toggleSection('rules')}
                            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                            <span className="text-xs font-medium text-gray-600">Regras Aplicadas</span>
                            {openSections.has('rules') ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            )}
                        </button>
                        {openSections.has('rules') && (
                            <div className="p-3 bg-white space-y-3">
                                {items.map((item) => (
                                    <div key={item.id} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                        <div className="font-medium text-xs text-gray-700 mb-1">{item.product?.name}</div>
                                        {item.fiscal_status === 'calculated' ? (
                                            <>
                                                <div className="text-xs text-gray-600">
                                                    <span className="font-medium">CFOP:</span> {item.cfop_code}
                                                </div>
                                                {item.fiscal_notes && (
                                                    <div className="text-xs text-gray-500 mt-1 italic">{item.fiscal_notes}</div>
                                                )}
                                            </>
                                        ) : item.fiscal_status === 'no_rule_found' ? (
                                            <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                <span>Regra não encontrada</span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400">Pendente</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sub-Section: Tax Preview */}
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <button
                            onClick={() => toggleSection('taxes')}
                            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                            <span className="text-xs font-medium text-gray-600">Impostos (preview técnico)</span>
                            {openSections.has('taxes') ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            )}
                        </button>
                        {openSections.has('taxes') && (
                            <div className="p-3 bg-white">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left pb-2 font-medium text-gray-500">Item</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">CST/CSOSN</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">ST</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">PIS</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">COFINS</th>
                                            <th className="text-left pb-2 font-medium text-gray-500">IPI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                                <td className="py-2 text-gray-700">{item.product?.name || '-'}</td>
                                                <td className="py-2 text-gray-600">{item.cst_icms || item.csosn || '-'}</td>
                                                <td className="py-2 text-gray-600">{item.st_applies ? `Sim (${item.st_aliquot}%)` : 'Não'}</td>
                                                <td className="py-2 text-gray-600">{item.pis_cst ? `${item.pis_cst} (${item.pis_aliquot}%)` : '-'}</td>
                                                <td className="py-2 text-gray-600">{item.cofins_cst ? `${item.cofins_cst} (${item.cofins_aliquot}%)` : '-'}</td>
                                                <td className="py-2 text-gray-600">{item.ipi_applies ? `Sim (${item.ipi_aliquot}%)` : 'Não'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
