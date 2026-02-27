import { createClient } from '@/utils/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModuleTabs } from '@/components/app/ModuleTabs';
import { LegacyNfeImportClient } from '@/components/fiscal/LegacyNfeImportClient';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const tabs = [
    {
        name: 'Notas de Saída',
        href: '/app/fiscal/nfe',
    },
    {
        name: 'Notas de Entrada',
        href: '/app/fiscal/configuracoes',
    },
    {
        name: 'Importar XML (Legado)',
        href: '/app/fiscal/nfe/importar-legado',
    },
];

export default async function LegacyNfeImportPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Importar XML NF-e Legada"
                subtitle="Inclua notas autorizadas do sistema antigo para consulta e estorno fiscal."
                children={<ModuleTabs items={tabs} />}
                actions={
                    <Link href="/app/fiscal/nfe">
                        <Button variant="secondary">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar para NF-e
                        </Button>
                    </Link>
                }
            />

            <div className="px-6">
                <LegacyNfeImportClient />
            </div>
        </div>
    );
}

