import { VehicleFormPage } from "@/components/fleet/VehicleFormPage";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Novo Veículo | Frota",
};

export default function NewVehiclePage() {
    return (
        <VehicleFormPage
            title="Novo Veículo"
            subtitle="Cadastre um novo veículo para controle de frota"
        />
    );
}
