import { PageHeader } from "@/components/ui/PageHeader";
import { AccountsTable } from "@/components/finance/AccountsTable";
import { Suspense } from "react";

export default function AccountsPage() {
    return (
        <div className="max-w-[1600px] mx-auto pb-10 space-y-6">
            <PageHeader
                title="Contas"
                subtitle="Gerencie suas contas a receber e a pagar em um único lugar."
            />

            <div className="px-6">
                <Suspense fallback={<div>Carregando...</div>}>
                    <AccountsTable />
                </Suspense>
            </div>
        </div>
    );
}
