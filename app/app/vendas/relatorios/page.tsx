import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleTabs } from "@/components/app/ModuleTabs";

const tabs = [
    {
        "name": "Pedidos",
        "href": "/app/vendas/pedidos"
    },
    {
        "name": "Orçamentos",
        "href": "/app/vendas/orcamentos"
    },
    {
        "name": "Relatórios",
        "href": "/app/vendas/relatorios"
    }
];

export default function Page() {
    return (
        <div className="max-w-7xl mx-auto pb-10">
            <PageHeader
                title="Vendas"
                subtitle="Gerencie suas operações."
                children={<ModuleTabs items={tabs} />}
            />
            <div className="p-10 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
                <h3 className="text-lg font-medium text-gray-900">Em construção</h3>
                <p>O módulo <strong>Relatórios</strong> estará disponível em breve.</p>
            </div>
        </div>
    );
}