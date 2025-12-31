"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { LogisticsTab } from "./LogisticsTab";
import { Button } from "@/components/ui/Button";
import { Settings, Truck, DollarSign, ShoppingBag, FileText, Target } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export function SystemPreferencesMain() {
    return (
        <div className="flex flex-col h-full">
            <PageHeader
                title="Preferências do Sistema"
                subtitle="Configurações globais do ERP (impacta todas as empresas)"
            />

            <div className="p-6">
                <Tabs defaultValue="logistics" className="w-full space-y-6">
                    <TabsList className="bg-white border border-gray-200 p-1 rounded-lg w-auto inline-flex gap-1 h-auto">
                        <TabsTrigger value="commercial" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-9 px-4">
                            <Target className="w-4 h-4 mr-2" />
                            Comercial
                        </TabsTrigger>
                        <TabsTrigger value="logistics" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-9 px-4">
                            <Truck className="w-4 h-4 mr-2" />
                            Logística
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-9 px-4">
                            <DollarSign className="w-4 h-4 mr-2" />
                            Financeiro
                        </TabsTrigger>
                        <TabsTrigger value="purchasing" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-9 px-4">
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Compras
                        </TabsTrigger>
                        <TabsTrigger value="fiscal" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-9 px-4">
                            <FileText className="w-4 h-4 mr-2" />
                            Fiscal
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="logistics" className="max-w-4xl space-y-6">
                        <LogisticsTab />
                    </TabsContent>

                    <TabsContent value="commercial">
                        <PlaceholderTab title="Comercial" />
                    </TabsContent>
                    <TabsContent value="finance">
                        <PlaceholderTab title="Financeiro" />
                    </TabsContent>
                    <TabsContent value="purchasing">
                        <PlaceholderTab title="Compras" />
                    </TabsContent>
                    <TabsContent value="fiscal">
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
