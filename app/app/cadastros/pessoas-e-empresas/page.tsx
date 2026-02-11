"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabaseBrowser";
import { getOrganizations, Organization, deleteOrganization } from "@/lib/clients-db";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCNPJ } from "@/lib/cnpj";
import { useToast } from "@/components/ui/use-toast";
import { ListPagination } from "@/components/ui/ListPagination";



// Extended type for list view data (with joined addresses)
interface OrganizationList extends Organization {
    addresses?: { city: string; state: string }[];
}

export default function PessoasEmpresasPage() {
    return (
        <Suspense>
            <PessoasEmpresasContent />
        </Suspense>
    )
}

function PessoasEmpresasContent() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const router = useRouter();
    const searchParams = useSearchParams();

    const [data, setData] = useState<OrganizationList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 100;
    const [allData, setAllData] = useState<OrganizationList[]>([]); // Store all records
    const [filteredData, setFilteredData] = useState<OrganizationList[]>([]); // Store filtered records
    // const [searchDebounced, setSearchDebounced] = useState(""); // Removed server-side debounce

    const { toast } = useToast();
    const toastShownRef = useRef<string | null>(null);

    // Check for success param on mount
    useEffect(() => {
        const successParam = searchParams?.get('success');
        if (successParam && toastShownRef.current !== successParam) {
            if (successParam === 'created') {
                toast({ title: "Sucesso", description: "Cadastro criado com sucesso!" });
            } else if (successParam === 'updated') {
                toast({ title: "Sucesso", description: "Cadastro atualizado com sucesso!" });
            }
            toastShownRef.current = successParam;
            router.replace('/app/cadastros/pessoas-e-empresas');
        }
    }, [searchParams, router, toast]);

    // Fetch ALL organizations once
    const fetchOrganizations = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            // Fetch all (no search param)
            const orgs = await getOrganizations(supabase, selectedCompany.id);
            const list = orgs as any[];
            setAllData(list);
            setFilteredData(list);
        } catch (error) {
            console.error("Failed to fetch organizations", error);
            toast({ title: "Erro", description: "Falha ao carregar lista.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizations();
    }, [selectedCompany]);

    // Client-side filtering logic
    useEffect(() => {
        if (!allData) return;

        // 1. Filter by Text (Search)
        let result = allData;

        if (search.trim()) {
            const lower = search.toLowerCase();
            result = result.filter(item =>
                (item.trade_name?.toLowerCase().includes(lower)) ||
                (item.legal_name?.toLowerCase().includes(lower)) ||
                (item.document_number?.includes(lower))
            );
        }

        // 2. Filter by Role (Optional - user has this UI but it said "In Development")
        // If we want to implement it now since we have the data... The user didn't ask explicitly but it makes sense.
        // The previous code had a warning saying it wasn't working.
        // Let's implement it if feasible. The 'role' check might require fetching roles too or checking properties.
        // OrganizationList doesn't explicitly have 'roles' array attached in the simple fetch?
        // getOrganizations returns "*, addresses(...)". 
        // It does NOT return roles by default unless joined (organization_roles).
        // So I will stick to just SEARCH filtering for now to be safe and identical to request.

        setFilteredData(result);

    }, [search, allData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, allData.length]);

    const totalFiltered = filteredData.length;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pagedData = filteredData.slice(startIndex, startIndex + PAGE_SIZE);



    const columns: Column<OrganizationList>[] = [
        {
            header: "Nome / Razão Social",
            cell: (row) => (
                <div>
                    <div className="text-sm font-bold text-gray-900 leading-tight">{row.trade_name}</div>
                    {row.legal_name && row.legal_name !== row.trade_name && (
                        <div className="text-xs text-gray-500 mt-0.5 font-medium">{row.legal_name}</div>
                    )}
                </div>
            ),
        },
        {
            header: "Documento",
            cell: (row) => (
                <span className="font-mono text-xs font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                    {row.document_number ? formatCNPJ(row.document_number) : "-"}
                </span>
            ),
        },
        {
            header: "Cidade/UF",
            cell: (row) => {
                const addr = row.addresses?.[0];
                if (!addr) return <span className="text-gray-400">-</span>;
                return (
                    <span className="text-sm font-medium text-gray-600">
                        {addr.city} <span className="text-gray-300">/</span> {addr.state}
                    </span>
                );
            },
        },
        {
            header: "Status",
            className: "text-center",
            cell: (row) => (
                <span
                    className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-2xl border ${row.status === "active"
                        ? "bg-green-50 text-green-700 border-green-100"
                        : "bg-gray-50 text-gray-400 border-gray-100"
                        }`}
                >
                    {row.status === "active" ? "Ativo" : "Inativo"}
                </span>
            ),
        },
        {
            header: "Ações",
            className: "w-24 text-right pr-6",
            cell: (row) => (
                <div className="flex justify-end items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-2xl hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/cadastros/pessoas-e-empresas/${row.id}`);
                        }}
                        title="Editar"
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-2xl hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Tem certeza que deseja excluir?")) {
                                handleDelete(row.id);
                            }
                        }}
                        title="Excluir"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ];

    const handleDelete = async (id: string) => {
        try {
            await deleteOrganization(supabase, id);
            toast({ title: "Sucesso", description: "Cadastro excluído com sucesso!" });
            fetchOrganizations(); // Refresh
        } catch (e) {
            console.error(e);
            toast({ title: "Erro", description: "Erro ao excluir cadastro.", variant: "destructive" });
        }
    }

    return (
        <div>
            <PageHeader
                title="Pessoas & Empresas"
                subtitle="Gerencie clientes, fornecedores e parceiros."
                actions={
                    <Link href="/app/cadastros/pessoas-e-empresas/novo">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Cadastro
                        </Button>
                    </Link>
                }
            />

            <div className="space-y-6 px-6 pb-6 max-w-screen-2xl mx-auto">
                <div className="flex gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome ou documento..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <DataTable
                    data={pagedData}
                    columns={columns}
                    isLoading={isLoading}
                    onRowClick={(row) => router.push(`/app/cadastros/pessoas-e-empresas/${row.id}`)}
                    emptyMessage="Nenhum cadastro encontrado."
                />
                <ListPagination
                    page={currentPage}
                    pageSize={PAGE_SIZE}
                    total={totalFiltered}
                    onPageChange={setCurrentPage}
                    label="cadastros"
                    disabled={isLoading}
                />
            </div>
        </div>
    );
}
