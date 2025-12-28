"use client";

import { useEffect, useState, Suspense } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabaseBrowser";
import { getOrganizations, Organization, deleteOrganization } from "@/lib/clients-db";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCNPJ } from "@/lib/cnpj";
import { Alert } from "@/components/ui/Alert";



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
    const [searchDebounced, setSearchDebounced] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Check for success param on mount
    useEffect(() => {
        const successParam = searchParams.get('success');
        if (successParam === 'created') {
            setSuccess("Cadastro criado com sucesso!");
            router.replace('/app/cadastros/pessoas-e-empresas');
        } else if (successParam === 'updated') {
            setSuccess("Cadastro atualizado com sucesso!");
            router.replace('/app/cadastros/pessoas-e-empresas');
        }
    }, [searchParams, router]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchDebounced(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchOrganizations = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            const orgs = await getOrganizations(supabase, selectedCompany.id, searchDebounced);
            setData(orgs as any);
        } catch (error) {
            console.error("Failed to fetch organizations", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizations();
    }, [selectedCompany, searchDebounced]);



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
                    className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${row.status === "active"
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
                        className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/cadastros/pessoas-e-empresas/${row.id}`);
                        }}
                        title="Editar"
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
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
            setSuccess("Cadastro excluído com sucesso!");
            fetchOrganizations(); // Refresh
        } catch (e) {
            console.error(e);
            setError("Erro ao excluir cadastro.");
        }
    }

    return (
        <div>
            {error && (
                <Alert variant="destructive" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert variant="success" onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}
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

            <div className="space-y-6 px-6 pb-6 max-w-[1600px] mx-auto">
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
                    <Select
                        value={roleFilter}
                        onValueChange={(val) => setRoleFilter(val)}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="customer">Clientes</SelectItem>
                            <SelectItem value="prospect">Prospects</SelectItem>
                            <SelectItem value="supplier">Fornecedores</SelectItem>
                            <SelectItem value="carrier">Transportadoras</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {
                    roleFilter !== "all" && (
                        <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200 text-sm">
                            <strong>Filtro por papel:</strong> Funcionalidade em desenvolvimento. Mostrando todos os cadastros.
                        </div>
                    )
                }

                <DataTable
                    data={data}
                    columns={columns}
                    isLoading={isLoading}
                    onRowClick={(row) => router.push(`/app/cadastros/pessoas-e-empresas/${row.id}`)}
                    emptyMessage="Nenhum cadastro encontrado."
                />
            </div>
        </div>
    );
}
