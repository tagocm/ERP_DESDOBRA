"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface ProductionSector {
    id: string;
    company_id: string;
    code: string;
    name: string;
    capacity_recipes: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

interface WorkOrderSectorCount {
    sector_id: string | null;
}

export function ProductionSectorsTab() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [sectors, setSectors] = useState<ProductionSector[]>([]);
    const [workOrderCountBySector, setWorkOrderCountBySector] = useState<Map<string, number>>(new Map());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSector, setEditingSector] = useState<ProductionSector | null>(null);
    const [formName, setFormName] = useState("");
    const [formCapacity, setFormCapacity] = useState("1");
    const [formActive, setFormActive] = useState(true);

    const totalSectors = sectors.length;
    const activeSectors = useMemo(() => sectors.filter((sector) => sector.is_active).length, [sectors]);

    const loadData = async () => {
        if (!selectedCompany) {
            return;
        }

        setIsLoading(true);
        try {
            const [{ data: sectorsData, error: sectorsError }, { data: workOrdersData, error: workOrdersError }] =
                await Promise.all([
                    supabase
                        .from("production_sectors")
                        .select("*")
                        .eq("company_id", selectedCompany.id)
                        .is("deleted_at", null)
                        .order("name", { ascending: true }),
                    supabase
                        .from("work_orders")
                        .select("sector_id")
                        .eq("company_id", selectedCompany.id)
                        .is("deleted_at", null),
                ]);

            if (sectorsError) {
                throw new Error(sectorsError.message);
            }

            if (workOrdersError) {
                throw new Error(workOrdersError.message);
            }

            const loadedSectors = (sectorsData ?? []) as ProductionSector[];
            const loadedWorkOrders = (workOrdersData ?? []) as WorkOrderSectorCount[];

            const countMap = new Map<string, number>();
            for (const workOrder of loadedWorkOrders) {
                if (!workOrder.sector_id) {
                    continue;
                }

                const current = countMap.get(workOrder.sector_id) ?? 0;
                countMap.set(workOrder.sector_id, current + 1);
            }

            setSectors(loadedSectors);
            setWorkOrderCountBySector(countMap);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao carregar setores.";
            toast({ title: "Erro", description: message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [selectedCompany]);

    const openCreateModal = () => {
        setEditingSector(null);
        setFormName("");
        setFormCapacity("1");
        setFormActive(true);
        setIsModalOpen(true);
    };

    const openEditModal = (sector: ProductionSector) => {
        setEditingSector(sector);
        setFormName(sector.name);
        setFormCapacity(String(sector.capacity_recipes));
        setFormActive(sector.is_active);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSector(null);
        setFormName("");
        setFormCapacity("1");
        setFormActive(true);
    };

    const saveSector = async () => {
        if (!selectedCompany) {
            return;
        }

        const normalizedName = formName.trim();
        const parsedCapacity = Number.parseInt(formCapacity, 10);

        if (!normalizedName) {
            toast({
                title: "Validação",
                description: "Nome é obrigatório.",
                variant: "destructive",
            });
            return;
        }

        if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
            toast({
                title: "Validação",
                description: "Capacidade deve ser um número inteiro maior ou igual a 1.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        try {
            if (editingSector) {
                const { error } = await supabase
                    .from("production_sectors")
                    .update({ name: normalizedName, capacity_recipes: parsedCapacity, is_active: formActive })
                    .eq("company_id", selectedCompany.id)
                    .eq("id", editingSector.id);

                if (error) {
                    throw new Error(error.message);
                }

                toast({ title: "Sucesso", description: "Setor atualizado." });
            } else {
                const { error } = await supabase.from("production_sectors").insert({
                    company_id: selectedCompany.id,
                    name: normalizedName,
                    capacity_recipes: parsedCapacity,
                    is_active: formActive,
                });

                if (error) {
                    throw new Error(error.message);
                }

                toast({ title: "Sucesso", description: "Setor criado." });
            }

            closeModal();
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao salvar setor.";
            toast({ title: "Erro", description: message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (sector: ProductionSector) => {
        if (!selectedCompany) {
            return;
        }

        const confirmed = window.confirm(`Deseja excluir o setor ${sector.name}?`);
        if (!confirmed) {
            return;
        }

        try {
            const { error } = await supabase
                .from("production_sectors")
                .update({ deleted_at: new Date().toISOString(), is_active: false })
                .eq("company_id", selectedCompany.id)
                .eq("id", sector.id);

            if (error) {
                throw new Error(error.message);
            }

            toast({ title: "Sucesso", description: "Setor removido." });
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao remover setor.";
            toast({ title: "Erro", description: message, variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-500">
                            Cadastre e mantenha setores para classificar OPs de produção e envase.
                        </p>
                        <Button onClick={openCreateModal}>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Setor
                        </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Total de setores</p>
                            <p className="text-2xl font-semibold text-gray-900">{totalSectors}</p>
                        </div>
                        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                            <p className="text-xs text-green-700 uppercase tracking-wide">Setores ativos</p>
                            <p className="text-2xl font-semibold text-green-800">{activeSectors}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Setores inativos</p>
                            <p className="text-2xl font-semibold text-gray-900">{totalSectors - activeSectors}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left">Código</th>
                                <th className="px-6 py-3 text-left">Nome</th>
                                <th className="px-6 py-3 text-right">Capacidade</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-right">OPs Vinculadas</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : sectors.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                        Nenhum setor de produção cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                sectors.map((sector) => (
                                    <tr key={sector.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{sector.code}</td>
                                        <td className="px-6 py-3 font-medium text-gray-900">{sector.name}</td>
                                        <td className="px-6 py-3 text-right font-medium text-gray-700">
                                            {sector.capacity_recipes} receitas
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                    sector.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                                                }`}
                                            >
                                                {sector.is_active ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-medium text-gray-700">
                                            {workOrderCountBySector.get(sector.id) ?? 0}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditModal(sector)}>
                                                    <Pencil className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                                    onClick={() => void handleDelete(sector)}
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
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingSector ? "Editar Setor" : "Novo Setor"}</DialogTitle>
                        <DialogDescription>Informe nome, capacidade e status do setor de produção.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Código</Label>
                            <Input
                                value={editingSector ? editingSector.code : "Gerado automaticamente"}
                                disabled
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input
                                value={formName}
                                onChange={(event) => setFormName(event.target.value)}
                                placeholder="Ex.: Produção de Granola"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Capacidade máxima (receitas)</Label>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={formCapacity}
                                onChange={(event) => setFormCapacity(event.target.value)}
                                placeholder="Ex.: 120"
                            />
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={formActive}
                                onChange={(event) => setFormActive(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            Setor ativo
                        </label>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal}>
                            Cancelar
                        </Button>
                        <Button onClick={() => void saveSector()} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
