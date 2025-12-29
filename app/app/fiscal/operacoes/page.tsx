"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Edit2, Copy, FileText, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { getFiscalOperations, deleteFiscalOperation, FiscalOperation } from "@/lib/data/fiscal-operations";
import { getTaxGroups } from "@/lib/data/tax-groups";

import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";

export default function FiscalOperationsPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();
    const { toast } = useToast();

    const [operations, setOperations] = useState<FiscalOperation[]>([]);
    const [taxGroups, setTaxGroups] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Delete Modal State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Filters
    const [searchState, setSearchState] = useState("");
    const [filterGroup, setFilterGroup] = useState("all");

    useEffect(() => {
        if (selectedCompany) {
            loadData();
        }
    }, [selectedCompany]);

    const loadData = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            // Fetch company settings to get Origin State
            const { data: settings } = await supabase
                .from('company_settings')
                .select('address_state')
                .eq('company_id', selectedCompany.id)
                .single();

            const originState = settings?.address_state || 'SP'; // Fallback to SP if missing, matching default migration

            const [ops, groups] = await Promise.all([
                getFiscalOperations(supabase, selectedCompany.id, { originState }),
                getTaxGroups(supabase, selectedCompany.id)
            ]);
            setOperations(ops);
            setTaxGroups(groups);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar dados", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteId(id);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteFiscalOperation(supabase, deleteId);
            toast({ title: "Regra excluída com sucesso", description: "Operação realizada." });
            loadData();
        } catch (error: any) {
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleteOpen(false);
            setDeleteId(null);
        }
    };

    const handleDuplicate = async (op: FiscalOperation, e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/app/fiscal/operacoes/novo?duplicate=${op.id}`);
    };

    // Filter Logic
    const filteredOps = operations.filter(op => {
        const matchState = !searchState || op.destination_state.toLowerCase().includes(searchState.toLowerCase());
        const matchGroup = filterGroup === 'all' || op.tax_group_id === filterGroup;
        return matchState && matchGroup;
    });

    return (
        <div>
            <PageHeader
                title="Operações Fiscais"
                subtitle="Configure as regras de tributação (CFOP, ICMS, IPI, PIS, COFINS)."
                actions={
                    <Button onClick={() => router.push("/app/fiscal/operacoes/novo")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Regra
                    </Button>
                }
            />

            <div className="max-w-[1600px] mx-auto px-6 h-full pb-8">
                <div className="mb-6 flex gap-4">
                    <div className="relative w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Filtrar por UF..."
                            className="pl-10 h-10 rounded-xl bg-white border-gray-200"
                            value={searchState}
                            onChange={(e) => setSearchState(e.target.value)}
                            maxLength={2}
                        />
                    </div>
                    <Select
                        value={filterGroup}
                        onValueChange={setFilterGroup}
                    >
                        <SelectTrigger className="w-64 h-10 rounded-xl bg-white border-gray-200">
                            <SelectValue placeholder="Todos os Grupos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Grupos</SelectItem>
                            {taxGroups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="overflow-hidden border border-gray-200 rounded-2xl bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Grupo Tributário</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">UF Destino</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Perfil Cliente</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Operação</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Tributação (Resumo)</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOps.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <FileText className="w-12 h-12 text-gray-300 opacity-50" />
                                            <p className="text-lg font-medium">Nenhuma regra encontrada</p>
                                            <p className="text-xs text-gray-400">
                                                Cadastre as operações fiscais para automatizar os impostos.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOps.map((op) => (
                                    <TableRow
                                        key={op.id}
                                        className="group border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/app/fiscal/operacoes/${op.id}`)}
                                    >
                                        <TableCell className="px-6 py-4">
                                            <span className="font-bold text-gray-700">{op.tax_group?.name || '-'}</span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-bold text-xs border border-brand-100">
                                                {op.destination_state}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-gray-600">
                                                    {op.customer_ie_indicator === 'contributor' ? 'Contribuinte' :
                                                        op.customer_ie_indicator === 'exempt' ? 'Isento' : 'Não Contribuinte'}
                                                </span>
                                                {op.customer_is_final_consumer && (
                                                    <span className="inline-flex items-center text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                                        Consumidor Final
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <span className="text-xs text-gray-500 uppercase">{op.operation_type === 'sales' ? 'Venda' : op.operation_type}</span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold bg-gray-100 px-1 rounded text-gray-600">CFOP {op.cfop}</span>
                                                </div>
                                                <div className="flex gap-2 text-[10px] text-gray-500">
                                                    <span>ICMS {op.icms_rate_percent}%</span>
                                                    {op.st_applies && <span className="text-amber-600 font-medium">+ ST</span>}
                                                    {op.ipi_applies && <span className="text-purple-600 font-medium">+ IPI</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right pr-6">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                                    title="Duplicar Regra"
                                                    onClick={(e) => handleDuplicate(op, e)}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-brand-50 hover:text-brand-600 text-gray-400 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/app/fiscal/operacoes/${op.id}`);
                                                    }}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                                    onClick={(e) => handleDelete(op.id, e)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <ConfirmDialogDesdobra
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                title="Excluir Regra Fiscal"
                description={
                    <div className="space-y-2">
                        <p>Tem certeza que deseja excluir esta regra fiscal permanentemente?</p>
                        <p className="font-semibold text-gray-900 text-sm">Esta ação não pode ser desfeita.</p>
                    </div>
                }
                confirmText="Excluir Regra"
                variant="danger"
                onConfirm={confirmDelete}
            />
        </div>
    );
}
