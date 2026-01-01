"use client";

import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { LogisticsTab } from "./LogisticsTab";
import { PageHeader } from "@/components/ui/PageHeader";

export function SystemPreferencesMain() {
    const [activeTab, setActiveTab] = useState("logistics");

    return (
        <div className="flex flex-col h-full">
            <PageHeader
                title="Preferências do Sistema"
                subtitle="Configurações globais do ERP (impacta todas as empresas)"
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <FormTabsList className="px-0 border-b-0">
                        <FormTabsTrigger value="commercial">Comercial</FormTabsTrigger>
                        <FormTabsTrigger value="logistics">Logística</FormTabsTrigger>
                        <FormTabsTrigger value="finance">Financeiro</FormTabsTrigger>
                        <FormTabsTrigger value="purchasing">Compras</FormTabsTrigger>
                        <FormTabsTrigger value="fiscal">Fiscal</FormTabsTrigger>
                    </FormTabsList>
                </Tabs>
            </PageHeader>

            <div className="p-6 max-w-[1600px] mx-auto w-full">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsContent value="logistics" className="mt-0 focus-visible:outline-none">
                        <LogisticsTab />
                    </TabsContent>

                    <TabsContent value="commercial" className="mt-0 focus-visible:outline-none">
                        <PlaceholderTab title="Comercial" />
                    </TabsContent>
                    <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
                        <PlaceholderTab title="Financeiro" />
                    </TabsContent>
                    <TabsContent value="purchasing" className="mt-0 focus-visible:outline-none">
                        <PlaceholderTab title="Compras" />
                    </TabsContent>
                    <TabsContent value="fiscal" className="mt-0 focus-visible:outline-none">
                        <PlaceholderTab title="Fiscal" />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

function PlaceholderTab({ title }: { title: string }) {
    return (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900">Módulo {title}</h3>
            <p className="text-gray-500 mt-2">Configurações globais para este módulo serão implementadas em breve.</p>
        </div>
    );
}
