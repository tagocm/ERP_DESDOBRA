"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

interface BOM {
    id: string;
    item_id: string;
    version: number;
    yield_qty: number;
    yield_uom: string;
    is_active: boolean;
    item?: {
        name: string;
        sku: string | null;
    };
}

export default function ReceitasPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();

    const [boms, setBoms] = useState<BOM[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (selectedCompany) {
            fetchBOMs();
        }
    }, [selectedCompany]);

    const fetchBOMs = async () => {
        if (!selectedCompany) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('bom_headers')
                .select(`
                    *,
                    item:items!bom_headers_item_id_fkey(name, sku)
                `)
                .eq('company_id', selectedCompany.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBoms(data || []);
        } catch (error) {
            console.error('Error fetching BOMs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta receita?')) return;

        try {
            const { error } = await supabase
                .from('bom_headers')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchBOMs();
        } catch (error) {
            console.error('Error deleting BOM:', error);
            alert('Erro ao excluir receita');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Receitas (BOM)"
                subtitle="PCP > Receitas"
                actions={
                    <Button onClick={() => router.push("/app/pcp/receitas/novo")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Receita
                    </Button>
                }
            />

            <Card className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Produto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Versão
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rendimento
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
                                </td>
                            </tr>
                        ) : boms.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="text-4xl">📋</div>
                                        <p className="text-lg font-medium">Nenhuma receita cadastrada</p>
                                        <p className="text-sm">
                                            Crie receitas para seus produtos acabados.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            boms.map((bom) => (
                                <tr
                                    key={bom.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => router.push(`/app/pcp/receitas/${bom.id}`)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {bom.item?.name}
                                        </div>
                                        {bom.item?.sku && (
                                            <div className="text-xs text-gray-500 font-mono">
                                                {bom.item.sku}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        v{bom.version}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                        {bom.yield_qty} {bom.yield_uom}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bom.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}
                                        >
                                            {bom.is_active ? 'Ativa' : 'Inativa'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/app/pcp/receitas/${bom.id}`);
                                                }}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(bom.id);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
