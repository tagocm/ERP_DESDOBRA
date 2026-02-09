import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Button } from "@/components/ui/Button";
import { Plus, Truck } from "lucide-react";
import Link from "next/link";
import { listVehicles } from "@/lib/data/fleet";
import { FleetTable } from "@/components/fleet/FleetTable";
import { FleetToolbarWrapper } from "@/components/fleet/FleetToolbarWrapper";
import { VehicleType } from "@/lib/types/fleet";

interface PageProps {
    searchParams: {
        q?: string;
        status?: string;
        type?: string;
    };
}

export default async function FrotaPage({ searchParams }: PageProps) {
    const search = searchParams.q || "";
    const status = searchParams.status || "active";
    const type = searchParams.type || "all";

    const vehicles = await listVehicles({
        search,
        isActive: status === "all" ? undefined : status === "active" ? true : false,
        type: type === "all" ? undefined : (type as VehicleType)
    });

    return (
        <div>
            <PageHeader
                title="Frota"
                subtitle="Gerenciamento de veículos e controle operacional"
                actions={
                    <Link href="/app/frota/novo">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Veículo
                        </Button>
                    </Link>
                }
            />

            <div className="max-w-screen-2xl mx-auto px-6 h-full">
                <Card className="overflow-hidden">
                    <CardHeaderStandard
                        title="Veículos Cadastrados"
                        icon={<Truck className="w-5 h-5" />}
                    />

                    <div className="px-6 py-4 border-b border-gray-50 bg-white">
                        <FleetToolbarWrapper
                            initialSearch={search}
                            initialStatus={status}
                            initialType={type}
                        />
                    </div>

                    <FleetTable vehicles={vehicles} />
                </Card>
            </div>
        </div>
    );
}
