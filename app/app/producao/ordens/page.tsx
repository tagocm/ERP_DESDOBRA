import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleTabs } from "@/components/app/ModuleTabs";

const tabs = [
    {
        "name": "Ordens de Produção",
        "href": "/app/producao/ordens"
    },
    {
        "name": "Fichas Técnicas",
        "href": "/app/producao/fichas-tecnicas"
    },
    {
        "name": "Apontamentos",
        "href": "/app/producao/apontamentos"
    }
];

export default function Page() {
    return (
        <div className="max-w-7xl mx-auto pb-10">
            <PageHeader
                title="Produção (PCP)"
                subtitle="Gerencie suas operações."
                children={<ModuleTabs items={tabs} />}
            />
            <div className="p-10 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
                <h3 className="text-lg font-medium text-gray-900">Em construção</h3>
                <p>O módulo <strong>Ordens de Produção</strong> estará disponível em breve.</p>
            </div>
        </div>
    );
}