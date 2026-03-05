"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Search, Plus, Calendar } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NewProductionEntryModal } from "@/components/production/NewProductionEntryModal";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { PcpModuleTabs } from "@/components/pcp/PcpModuleTabs";
import { normalizeReferenceType } from "@/lib/constants/inventory-ledger";

interface MovementItemRow {
    name: string;
    uom: string;
}

interface InventoryMovementRow {
    id: string;
    occurred_at: string;
    qty_in: number | null;
    notes: string | null;
    reference_id: string | null;
    reference_type: string | null;
    item: MovementItemRow | MovementItemRow[] | null;
}

interface ProductionRecord {
    id: string;
    occurred_at: string;
    qty_in: number;
    notes: string | null;
    reference_id: string;
    reference_type: string | null;
    item: MovementItemRow | null;
}

export default function NotesPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [records, setRecords] = useState<ProductionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (selectedCompany) fetchRecords();
    }, [selectedCompany]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const canonicalPromise = supabase
                .from('inventory_movements')
                .select(`
                    id,
                    occurred_at,
                    qty_in,
                    notes,
                    reference_id,
                    reference_type,
                    item:items (name, uom)
                `)
                .eq('company_id', selectedCompany!.id)
                .eq('movement_type', 'PRODUCTION_OUTPUT')
                .in('reference_type', ['work_order', 'WORK_ORDER'])
                .order('occurred_at', { ascending: false })
                .limit(50);

            const legacyPromise = supabase
                .from('inventory_movements')
                .select(`
                    id,
                    occurred_at,
                    qty_in,
                    notes,
                    reference_id,
                    reference_type,
                    item:items (name, uom)
                `)
                .eq('company_id', selectedCompany!.id)
                .eq('movement_type', 'ENTRADA')
                .eq('reason', 'production_in')
                .in('reference_type', ['work_order', 'WORK_ORDER'])
                .order('occurred_at', { ascending: false })
                .limit(50);

            const [canonicalQuery, legacyQuery] = await Promise.all([canonicalPromise, legacyPromise]);
            if (canonicalQuery.error) throw canonicalQuery.error;
            if (legacyQuery.error) throw legacyQuery.error;

            const allRows = [...(canonicalQuery.data ?? []), ...(legacyQuery.data ?? [])] as InventoryMovementRow[];
            const dedupedById = new Map<string, ProductionRecord>();
            for (const row of allRows) {
                if (!row.id || !row.reference_id) continue;
                if (normalizeReferenceType(row.reference_type) !== "work_order") continue;
                const item = Array.isArray(row.item) ? row.item[0] ?? null : row.item;
                dedupedById.set(row.id, {
                    id: row.id,
                    occurred_at: row.occurred_at,
                    qty_in: Number(row.qty_in ?? 0),
                    notes: row.notes,
                    reference_id: row.reference_id,
                    reference_type: row.reference_type,
                    item,
                });
            }

            const sorted = Array.from(dedupedById.values()).sort((a, b) =>
                new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
            );
            setRecords(sorted.slice(0, 50));
        } catch (error) {
            console.error("Error fetching production records:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredRecords = records.filter(r =>
        r.item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reference_id?.includes(searchTerm) ||
        r.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <NewProductionEntryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchRecords}
            />

            <PageHeader
                title="Apontamentos de Produção"
                subtitle="Histórico de produção e entradas de estoque."
                children={<PcpModuleTabs />}
                actions={
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Apontamento
                    </Button>
                }
            />

            <div className="px-6">
                <Card>
                    <CardContent className="p-0">
                        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100/70">
                            <div className="w-full md:w-80 relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                <Input
                                    placeholder="Buscar produto ou OP..."
                                    className="pl-9 h-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Data</th>
                                        <th className="px-6 py-3 text-left">Ordem (OP)</th>
                                        <th className="px-6 py-3 text-left">Produto</th>
                                        <th className="px-6 py-3 text-right">Qtd. Produzida</th>
                                        <th className="px-6 py-3 text-left">Observações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                Carregando...
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                Nenhum apontamento encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                        {format(new Date(record.occurred_at), "dd/MM/yyyy HH:mm")}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 font-mono text-xs text-blue-600">
                                                    #{record.reference_id?.slice(0, 8)}
                                                </td>
                                                <td className="px-6 py-3 font-medium text-gray-900">
                                                    {record.item?.name}
                                                </td>
                                                <td className="px-6 py-3 text-right font-medium text-green-700">
                                                    +{record.qty_in} <span className="text-xs font-normal text-green-500">{record.item?.uom}</span>
                                                </td>
                                                <td className="px-6 py-3 text-gray-500 text-xs italic max-w-xs truncate">
                                                    {record.notes || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
