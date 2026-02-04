"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Database } from "@/types/supabase";
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Search, Eye, FileText, CheckCircle2, Package, Calculator, Database as DatabaseIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Separator } from "@/components/ui/separator";

// Types
interface BomHeader {
    id: string;
    version: number;
    yield_qty: number;
    yield_uom: string;
    is_active: boolean;
    created_at: string;
    item: {
        id: string;
        name: string;
        sku: string;
    } | null;
}

interface BomDetail extends BomHeader {
    lines: {
        id: string;
        qty: number;
        uom: string;
        notes: string | null;
        item: {
            name: string;
            sku: string;
            avg_cost: number;
        };
    }[];
    byproducts: {
        id: string;
        qty: number;
        item: {
            name: string;
            sku: string;
        };
    }[];
}

export default function BomListPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [boms, setBoms] = useState<BomHeader[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Drawer State
    const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
    const [bomDetail, setBomDetail] = useState<BomDetail | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    useEffect(() => {
        if (selectedCompany) fetchBoms();
    }, [selectedCompany]);

    useEffect(() => {
        if (selectedBomId) fetchBomDetail(selectedBomId);
    }, [selectedBomId]);

    const fetchBoms = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('bom_headers')
                .select(`
                    id,
                    version,
                    yield_qty,
                    yield_uom,
                    is_active,
                    created_at,
                    item:items!inner (id, name, sku)
                `)
                .eq('company_id', selectedCompany!.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedBoms: BomHeader[] = (data || []).map((b: any) => ({
                ...b,
                item: Array.isArray(b.item) ? b.item[0] : b.item
            }));

            setBoms(mappedBoms);
        } catch (error) {
            console.error("Error fetching BOMs:", error);
            toast({ title: "Erro", description: "Falha ao carregar fichas técnicas.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBomDetail = async (id: string) => {
        setIsDetailLoading(true);
        try {
            // Fetch Header Info
            const { data: header, error: headerError } = await supabase
                .from('bom_headers')
                .select(`
                    *,
                    item:items (id, name, sku)
                `)
                .eq('id', id)
                .single();

            if (headerError) throw headerError;

            // Fetch Lines
            const { data: lines, error: linesError } = await supabase
                .from('bom_lines')
                .select(`
                    id, qty, uom, notes,
                    item:items (name, sku, avg_cost)
                `)
                .eq('bom_id', id)
                .order('sort_order');

            if (linesError) throw linesError;

            // Fetch Byproducts
            const { data: byproducts, error: bpError } = await supabase
                .from('bom_byproduct_outputs')
                .select(`
                    id, qty,
                    item:items (name, sku)
                `)
                .eq('bom_id', id);

            if (bpError) throw bpError;

            setBomDetail({
                ...header,
                item: Array.isArray(header.item) ? header.item[0] : header.item,
                lines: (lines || []).map((l: any) => ({
                    ...l,
                    item: Array.isArray(l.item) ? l.item[0] : l.item
                })),
                byproducts: (byproducts || []).map((b: any) => ({
                    ...b,
                    item: Array.isArray(b.item) ? b.item[0] : b.item
                }))
            } as BomDetail);

        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar detalhes da ficha.", variant: "destructive" });
        } finally {
            setIsDetailLoading(false);
        }
    };

    const filteredBoms = boms.filter(b =>
        b.item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.item?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">

            <Card>
                <CardHeaderStandard
                    icon={<DatabaseIcon className="w-5 h-5 text-brand-600" />}
                    title="Estrutura de Materiais (BOM)"
                    description="Defina os componentes e subprodutos para este item."
                >
                    <div className="mt-4 pb-2 border-b border-gray-100/50">
                        <div className="w-64 relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                            <Input
                                placeholder="Buscar produto ou SKU..."
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
                                    <th className="px-6 py-3 text-left">Produto</th>
                                    <th className="px-6 py-3 text-left">SKU</th>
                                    <th className="px-6 py-3 text-center">Versão</th>
                                    <th className="px-6 py-3 text-left">Rendimento</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            Carregando...
                                        </td>
                                    </tr>
                                ) : filteredBoms.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            Nenhuma ficha técnica encontrada.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBoms.map((bom) => (
                                        <tr key={bom.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900">
                                                {bom.item?.name}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500">
                                                {bom.item?.sku || '-'}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <Badge variant="outline" className="font-mono">v{bom.version}</Badge>
                                            </td>
                                            <td className="px-6 py-3 text-gray-700">
                                                {bom.yield_qty} {bom.yield_uom}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {bom.is_active ? (
                                                    <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">Ativa</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Inativa</Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => setSelectedBomId(bom.id)}
                                                    title="Visualizar Detalhes"
                                                >
                                                    <Eye className="w-4 h-4 text-gray-400" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Bom Details Drawer - Custom Sheet w/o subcomponents */}
            <Sheet
                isOpen={!!selectedBomId}
                onClose={() => setSelectedBomId(null)}
                title="Ficha Técnica"
                side="right"
            >
                {isDetailLoading || !bomDetail ? (
                    <div className="flex-1 flex items-center justify-center min-h-96">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-8 w-8 bg-gray-200 rounded-full mb-2"></div>
                            <div className="h-4 w-32 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Produto Final</h4>
                            <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                <Card className="p-2 bg-white border-gray-200">
                                    <Package className="w-5 h-5 text-brand-600" />
                                </Card>
                                <div>
                                    <p className="font-medium text-gray-900">{bomDetail.item?.name}</p>
                                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                        <span>SKU: {bomDetail.item?.sku || 'N/A'}</span>
                                        <span>•</span>
                                        <span>Versão: {bomDetail.version}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Calculator className="w-4 h-4 text-blue-600" />
                                    <span className="text-xs font-semibold text-blue-700 uppercase">Rendimento</span>
                                </div>
                                <p className="text-lg font-bold text-gray-900">
                                    {bomDetail.yield_qty} <span className="text-sm font-normal text-gray-500">{bomDetail.yield_uom}</span>
                                </p>
                            </div>
                            <div className="bg-green-50/50 p-3 rounded-2xl border border-green-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <span className="text-xs font-semibold text-green-700 uppercase">Status</span>
                                </div>
                                <p className="text-lg font-bold text-gray-900">
                                    {bomDetail.is_active ? 'Ativa' : 'Inativa'}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Ingredients */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center justify-between">
                                Lista de Insumos
                                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {bomDetail.lines.length} itens
                                </span>
                            </h4>
                            <Card className="overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">Item</th>
                                            <th className="px-4 py-2 text-right font-medium">Qtd.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {bomDetail.lines.map((line) => (
                                            <tr key={line.id}>
                                                <td className="px-4 py-2">
                                                    <span className="block font-medium text-gray-700">{line.item.name}</span>
                                                    {line.notes && <span className="text-xs text-gray-400 italic">{line.notes}</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-700">
                                                    {line.qty} <span className="text-xs text-gray-400">{line.uom}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {bomDetail.lines.length === 0 && (
                                        <tbody>
                                            <tr>
                                                <td colSpan={2} className="px-4 py-4 text-center text-gray-400 italic">
                                                    Nenhum insumo cadastrado.
                                                </td>
                                            </tr>
                                        </tbody>
                                    )}
                                </table>
                            </Card>
                        </div>

                        {/* Byproducts */}
                        {bomDetail.byproducts.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center justify-between">
                                    Co-produtos / Subprodutos
                                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        {bomDetail.byproducts.length} itens
                                    </span>
                                </h4>
                                <Card className="overflow-hidden border-orange-100">
                                    <table className="w-full text-sm">
                                        <thead className="bg-orange-50 text-orange-700 text-xs">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium">Saída</th>
                                                <th className="px-4 py-2 text-right font-medium">Qtd.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-orange-100/50">
                                            {bomDetail.byproducts.map((bp) => (
                                                <tr key={bp.id}>
                                                    <td className="px-4 py-2 font-medium text-gray-700">
                                                        {bp.item.name}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-gray-700">
                                                        {bp.qty}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Card>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 pb-10">
                            <Button variant="outline" className="w-full" onClick={() => setSelectedBomId(null)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </Sheet>

        </div>
    );
}
