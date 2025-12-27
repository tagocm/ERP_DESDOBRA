
"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { useRouter, usePathname } from "next/navigation";

import { User } from "@supabase/supabase-js";

interface Company {
    id: string;
    name: string;
    slug: string;
}

interface CompanyContextType {
    companies: Company[];
    selectedCompany: Company | null;
    setSelectedCompany: (company: Company) => void;
    selectCompany: (companyId: string) => void;
    isLoading: boolean;
    user: User | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const supabase = createClient();
    const router = useRouter();
    const pathname = usePathname();

    const selectCompany = useCallback((companyId: string) => {
        const company = companies.find((c) => c.id === companyId);
        if (company) {
            setSelectedCompany(company);
            localStorage.setItem("selectedCompanyId", companyId);
        }
    }, [companies]);

    useEffect(() => {
        async function fetchCompanies() {
            try {


                // Check auth first
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    router.push("/login");
                    return;
                }

                setUser(user);



                // Fetch companies via explicit membership to handle RLS and duplicates correctly
                const { data: members, error } = await supabase
                    .from("company_members")
                    .select("company:companies(id, name, slug)")
                    .eq("auth_user_id", user.id);

                if (error) {
                    console.error("Error fetching companies:", error);
                    return;
                }

                if (members) {
                    // Extract companies from the join result
                    // The type assertion or map is needed because supabase returns nested object
                    const mappedCompanies = members
                        .map((m: any) => m.company)
                        .filter((c: any) => c !== null) as Company[];

                    setCompanies(mappedCompanies);

                    // Auto-selection logic
                    const storedId = localStorage.getItem("selectedCompanyId");
                    if (mappedCompanies.length === 1) {
                        setSelectedCompany(mappedCompanies[0]);
                        localStorage.setItem("selectedCompanyId", mappedCompanies[0].id);
                    } else if (storedId) {
                        const found = mappedCompanies.find((c) => c.id === storedId);
                        if (found) {
                            setSelectedCompany(found);
                        }
                    }
                }
            } finally {
                setIsLoading(false);
            }
        }

        fetchCompanies();
    }, [supabase, router]);

    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center">Loading...</div>
    }

    // Bypass company checks if we are on the creation page
    // This allows the route /app/new-company to render its own content
    // instead of being blocked by the "No company" state below.
    if (pathname === '/app/new-company') {
        return (
            <CompanyContext.Provider
                value={{ companies, selectedCompany, setSelectedCompany, selectCompany, isLoading, user }}
            >
                {children}
            </CompanyContext.Provider>
        );
    }

    // Force selection if multiple companies available and none selected
    if (!isLoading && companies.length > 0 && !selectedCompany) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50">
                <h1 className="text-2xl font-bold">Selecione uma Empresa</h1>
                <div className="flex flex-col gap-2">
                    {companies.map(company => (
                        <button
                            key={company.id}
                            onClick={() => selectCompany(company.id)}
                            className="rounded-md bg-white px-6 py-3 shadow-md hover:bg-gray-100 border border-gray-200"
                        >
                            {company.name}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // Edge case: No companies found (redirect to new company page placeholder)
    if (!isLoading && companies.length === 0) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-8 bg-gray-50">
                <h1 className="text-xl font-bold mb-2">Nenhuma empresa encontrada</h1>
                <p className="text-gray-600 mb-4">Você precisa criar ou ser convidado para uma empresa.</p>
                <button
                    onClick={() => router.push('/app/new-company')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Criar Nova Empresa
                </button>
            </div>
        )
    }

    return (
        <CompanyContext.Provider
            value={{ companies, selectedCompany, setSelectedCompany, selectCompany, isLoading, user }}
        >
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompany() {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error("useCompany must be used within a CompanyProvider");
    }
    return context;
}
