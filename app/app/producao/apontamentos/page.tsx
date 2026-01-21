"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { ClipboardList, Plus, Search, Calendar, User, Package } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NewProductionEntryModal } from "@/components/production/NewProductionEntryModal";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";

export default function NotesPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (selectedCompany) fetchRecords();
    }, [selectedCompany]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
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
                .eq('reference_type', 'WORK_ORDER')
                .order('occurred_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const mappedData = (data || []).map((r: any) => ({
                ...r,
                item: Array.isArray(r.item) ? r.item[0] : r.item
            }));

            setRecords(mappedData);
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

            <Card>
                <CardHeaderStandard
                    icon={<ClipboardList className="w-5 h-5 text-brand-600" />}
                    title="Apontamentos de Produção"
                    subtitle="Histórico de produção e entradas de estoque."
                    actions={
                        <Button onClick={() => setIsModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Apontamento
                        </Button>
                    }
                >
                    <div className="mt-4 pb-2 border-b border-gray-100/50">
                        <div className="w-64 relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                            <Input
                                placeholder="Buscar produto ou OP..."
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeaderStandard>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
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
    );
}