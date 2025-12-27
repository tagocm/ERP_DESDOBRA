
import { PageHeader } from "@/components/ui/PageHeader";

export default function DashboardPage() {
    return (
        <div className="space-y-4">
            <PageHeader
                title="Dashboard"
                subtitle="Bem-vindo ao ERP Desdobra."
            />
            <div className="px-6">
                <p className="text-gray-600">
                    Selecione um item no menu para começar.
                </p>
            </div>
        </div>
    );
}
