import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleTabs } from "@/components/app/ModuleTabs";

const tabs = [
    {
        "name": "Conta",
        "href": "/app/configuracoes/conta"
    },
    {
        "name": "Empresa",
        "href": "/app/configuracoes/empresa"
    },
    {
        "name": "Preferências",
        "href": "/app/configuracoes/preferencias"
    },
    {
        "name": "Cadastros Básicos",
        "href": "/app/configuracoes/cadastros-basicos"
    }
];

export default function Page() {
    return (
        <div>
            <PageHeader
                title="Configurações"
                subtitle="Gerencie suas operações."
                children={<ModuleTabs items={tabs} />}
            />
            <div className="max-w-7xl mx-auto px-8 pb-10">
                <div className="p-10 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
                    <h3 className="text-lg font-medium text-gray-900">Em construção</h3>
                    <p>O módulo <strong>Cadastros Básicos</strong> estará disponível em breve.</p>
                </div>
            </div>
        </div>
    );
}