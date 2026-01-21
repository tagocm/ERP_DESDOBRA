
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

                    // Auto-selection / Single Tenant Logic
                    if (process.env.NEXT_PUBLIC_DEV_COMPANY_ID) {
                        const devId = process.env.NEXT_PUBLIC_DEV_COMPANY_ID;
                        const devCompany = mappedCompanies.find(c => c.id === devId);
                        if (devCompany) {
                            setSelectedCompany(devCompany);
                        } else if (mappedCompanies.length > 0) {
                            // Fallback: Dev ID invalid for this user, pick first
                            setSelectedCompany(mappedCompanies[0]);
                        }
                    } else {
                        // Production / Default: Always pick the first one found
                        if (mappedCompanies.length > 0) {
                            setSelectedCompany(mappedCompanies[0]);
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
        return <div className="flex h-screen w-full items-center justify-center">Carregando sistema...</div>
    }

    if (pathname === '/app/new-company') {
        return (
            <CompanyContext.Provider value={{ companies, selectedCompany, setSelectedCompany, selectCompany, isLoading, user }}>
                {children}
            </CompanyContext.Provider>
        );
    }

    // BLOCKING: If no company found
    if (!selectedCompany) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-8 bg-gray-50">
                <div className="max-w-md text-center space-y-4">
                    <h1 className="text-xl font-bold text-red-600">Acesso Bloqueado</h1>
                    <p className="text-gray-700">
                        Seu usuário não está vinculado a nenhuma empresa.
                    </p>
                    <p className="text-sm text-gray-500">
                        Single-Tenant Mode: É necessário ser membro da empresa ativa.
                    </p>
                    {process.env.NEXT_PUBLIC_DEV_COMPANY_ID && (
                        <code className="block bg-gray-100 p-2 text-xs rounded text-left">
                            DEV_COMPANY_ID: {process.env.NEXT_PUBLIC_DEV_COMPANY_ID}
                        </code>
                    )}
                </div>
            </div>
        )
    }

    // Render Children (Always Single Tenant)
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
