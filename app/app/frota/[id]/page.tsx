import { VehicleFormPage } from "@/components/fleet/VehicleFormPage";
import { getVehicleById } from "@/lib/data/fleet";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const vehicle = await getVehicleById(id);
    return {
        title: vehicle ? `Editar ${vehicle.name} | Frota` : "Veículo não encontrado",
    };
}

export default async function EditVehiclePage({ params }: PageProps) {
    const { id } = await params;

    const vehicle = await getVehicleById(id).catch(() => null);
    if (!vehicle) notFound();

    return (
        <VehicleFormPage
            title={`Editar ${vehicle.name}`}
            subtitle="Atualize os dados e documentos do veículo"
            initialData={vehicle}
            isEdit={true}
        />
    );
}
