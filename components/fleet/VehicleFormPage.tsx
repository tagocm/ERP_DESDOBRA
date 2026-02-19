"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { VehicleForm } from "@/components/fleet/VehicleForm";
import { FuelRecordsTab } from "@/components/fleet/fuel/FuelRecordsTab";
import { TollRecordsTab } from "@/components/fleet/toll/TollRecordsTab";
import { TrafficFinesTab } from "@/components/fleet/fines/TrafficFinesTab";
import { VehicleDocumentsTab } from "@/components/fleet/documents/VehicleDocumentsTab";
import { FleetVehicleRow } from "@/lib/types/fleet";
import { Loader2, Save } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";

interface VehicleFormPageProps {
    title: string;
    subtitle: string;
    initialData?: FleetVehicleRow;
    isEdit?: boolean;
}

const VEHICLE_TABS = [
    { value: "identificacao", label: "Identificação" },
    { value: "abastecimentos", label: "Abastecimentos" },
    { value: "pedagios", label: "Pedágios" },
    { value: "multas", label: "Multas" },
    { value: "documentos", label: "Documentos" },
    { value: "manutencao", label: "Manutenção" },
    { value: "rotas", label: "Rotas" },
];

export function VehicleFormPage({ title, subtitle, initialData, isEdit }: VehicleFormPageProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("identificacao");

    const handleSubmit = () => {
        // Trigger form submission via the form's submit event
        const form = document.getElementById('vehicle-form') as HTMLFormElement;
        if (form) {
            form.requestSubmit();
        }
    };

    return (
        <div>
            <PageHeader
                title={title}
                subtitle={subtitle}
                actions={
                    <div className="flex items-center gap-3">
                        <Link href="/app/frota">
                            <Button variant="ghost" type="button" className="text-gray-500 hover:text-gray-900" disabled={isSubmitting}>
                                Cancelar
                            </Button>
                        </Link>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Veículo
                        </Button>
                    </div>
                }
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <FormTabsList className="px-0 border-b-0">
                        {VEHICLE_TABS.map(tab => (
                            <FormTabsTrigger key={tab.value} value={tab.value}>
                                {tab.label}
                            </FormTabsTrigger>
                        ))}
                    </FormTabsList>
                </Tabs>
            </PageHeader>

            <div className="max-w-screen-2xl mx-auto px-6 h-full">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsContent value="identificacao" className="mt-0 focus-visible:outline-none">
                        <VehicleForm
                            initialData={initialData}
                            isEdit={isEdit}
                            onSubmitStateChange={setIsSubmitting}
                        />
                    </TabsContent>

                    <TabsContent value="abastecimentos" className="mt-0 focus-visible:outline-none">
                        {initialData?.id ? (
                            <FuelRecordsTab vehicleId={initialData.id} vehicleData={initialData} />
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center space-y-3">
                                    <p className="text-lg font-semibold text-gray-900">Abastecimentos</p>
                                    <p className="text-sm text-gray-500">Salve o veículo primeiro para registrar abastecimentos</p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="pedagios" className="mt-0 focus-visible:outline-none">
                        {initialData?.id ? (
                            <TollRecordsTab vehicleId={initialData.id} />
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center space-y-3">
                                    <p className="text-lg font-semibold text-gray-900">Pedágios</p>
                                    <p className="text-sm text-gray-500">Salve o veículo primeiro para registrar pedágios</p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="multas" className="mt-0 focus-visible:outline-none">
                        {initialData?.id ? (
                            <TrafficFinesTab vehicleId={initialData.id} />
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center space-y-3">
                                    <p className="text-lg font-semibold text-gray-900">Multas</p>
                                    <p className="text-sm text-gray-500">Salve o veículo primeiro para registrar multas</p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="documentos" className="mt-0 focus-visible:outline-none">
                        {initialData?.id ? (
                            <VehicleDocumentsTab vehicleId={initialData.id} />
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center space-y-3">
                                    <p className="text-lg font-semibold text-gray-900">Documentos</p>
                                    <p className="text-sm text-gray-500">Salve o veículo primeiro para registrar documentos</p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {VEHICLE_TABS.slice(5).map(tab => (
                        <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center space-y-3">
                                    <p className="text-lg font-semibold text-gray-900">{tab.label}</p>
                                    <p className="text-sm text-gray-500">Em desenvolvimento</p>
                                </div>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    );
}
