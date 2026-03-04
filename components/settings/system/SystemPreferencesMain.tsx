"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { LogisticsTab } from "./LogisticsTab";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChartOfAccountsTab } from "@/components/finance/chart-of-accounts/ChartOfAccountsTab";
import { ProductionSectorsTab } from "./ProductionSectorsTab";

const VALID_TABS = ["logistics", "production", "finance"] as const;
type PreferencesTab = (typeof VALID_TABS)[number];

function isPreferencesTab(value: string | null): value is PreferencesTab {
    return Boolean(value && VALID_TABS.includes(value as PreferencesTab));
}

export function SystemPreferencesMain() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<PreferencesTab>("logistics");

    useEffect(() => {
        const queryTab = searchParams.get("tab");
        if (isPreferencesTab(queryTab) && queryTab !== activeTab) {
            setActiveTab(queryTab);
        }
    }, [searchParams, activeTab]);

    const handleTabChange = (nextTabValue: string) => {
        if (!isPreferencesTab(nextTabValue)) {
            return;
        }

        setActiveTab(nextTabValue);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", nextTabValue);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex flex-col h-full">
            <PageHeader
                title="Preferências do Sistema"
                subtitle="Configurações globais do ERP (impacta todas as empresas)"
            >
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <FormTabsList className="px-0 border-b-0">
                        <FormTabsTrigger value="logistics">Logística</FormTabsTrigger>
                        <FormTabsTrigger value="production">Produção</FormTabsTrigger>
                        <FormTabsTrigger value="finance">Plano de Contas</FormTabsTrigger>
                    </FormTabsList>
                </Tabs>
            </PageHeader>

            <div className="p-6 max-w-screen-2xl mx-auto w-full">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                    <TabsContent value="logistics" className="mt-0 focus-visible:outline-none">
                        <LogisticsTab />
                    </TabsContent>

                    <TabsContent value="production" className="mt-0 focus-visible:outline-none">
                        <ProductionSectorsTab />
                    </TabsContent>
                    <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
                        <ChartOfAccountsTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
