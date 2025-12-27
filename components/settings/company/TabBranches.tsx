"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { getBranches, Branch } from "@/lib/data/company-settings";
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
                const data = await getBranches(supabase, selectedCompany.id);
                if (mounted) setBranches(data || []);
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
                        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-100 flex items-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {branches.length === 0 && !loading && !error && (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
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
                            <div key={branch.id} className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
                                        <Building2 className="w-5 h-5" />
                                    </div>
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
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                        Ativa
                                    </span>
                                    {isAdmin && (
                                        <Button variant="ghost" size="sm" onClick={() => alert("Edição de filial em breve.")}>
                                            Editar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
