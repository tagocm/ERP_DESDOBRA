"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { getBranchesAction } from "@/app/actions/settings/branches-actions";
// Keeping Branch type alias if not in DTO yet, or redefine locally/shared
import { Branch } from "@/lib/types/settings-types";
import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Plus, Building2, Store } from "lucide-react";

interface TabBranchesProps {
    isAdmin: boolean;
}

export function TabBranches({ isAdmin }: TabBranchesProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedCompany) return;

        let mounted = true;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getBranchesAction();
                if (mounted && res.success) setBranches(res.data || []);
                if (!res.success && mounted) {
                    setError("Não foi possível carregar as filiais: " + res.error);
                }
            } catch (e: any) {
                console.warn("Failed to load branches:", e);
                // Don't crash full UI, just show local error state
                if (mounted) {
                    setError("Não foi possível carregar as filiais. Verifique suas permissões.");
                    setBranches([]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();

        return () => { mounted = false; };
    }, [selectedCompany]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeaderStandard
                    icon={<Store className="w-5 h-5" />}
                    title="Filiais"
                    actions={
                        isAdmin && (
                            <Button onClick={() => alert("Funcionalidade de cadastro de filial será implementada em breve.")} size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Nova Filial
                            </Button>
                        )
                    }
                />
                <CardContent>

                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-2xl text-sm border border-red-100 flex items-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {branches.length === 0 && !loading && !error && (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Store className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>Nenhuma filial cadastrada.</p>
                            </div>
                        )}

                        {loading && (
                            <div className="text-center py-12 text-gray-500">
                                <Store className="w-10 h-10 mx-auto mb-3 opacity-20 animate-pulse" />
                                <p>Carregando...</p>
                            </div>
                        )}

                        {branches.map(branch => (
                            <Card key={branch.id} className="hover:bg-gray-50 transition-colors">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Card className="w-10 h-10 bg-brand-50 flex items-center justify-center text-brand-600 border-brand-100">
                                            <Building2 className="w-5 h-5" />
                                        </Card>
                                        <div>
                                            <p className="font-medium text-gray-900">{branch.name}</p>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono">
                                                    {branch.settings?.cnpj || "CNPJ N/A"}
                                                </span>
                                                <span>•</span>
                                                <span>{branch.settings?.address_city}/{branch.settings?.address_state}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-2xl text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                            Ativa
                                        </span>
                                        {isAdmin && (
                                            <Button variant="ghost" size="sm" onClick={() => alert("Edição de filial em breve.")}>
                                                Editar
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
