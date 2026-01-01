import { PageHeader } from "@/components/ui/PageHeader";
// ModuleTabs removed

// Tabs definitions removed

export default function Page() {
    return (
        <div>
            <PageHeader
                title="Preferências"
                subtitle="Ajustes gerais do sistema."
            />
            <div className="max-w-7xl mx-auto px-8 pb-10">
                <div className="p-10 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
                    <h3 className="text-lg font-medium text-gray-900">Em construção</h3>
                    <p>O módulo <strong>Preferências</strong> estará disponível em breve.</p>
                </div>
            </div>
        </div>
    );
}