import { createClient } from '@/utils/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModuleTabs } from '@/components/app/ModuleTabs';
import { InvoiceListClient } from '@/components/fiscal/InvoiceListClient';
import { Button } from '@/components/ui/Button';
import { Plus, FileText } from 'lucide-react';
import Link from 'next/link';

type NfeListView = 'pending' | 'issued' | 'cancelled' | 'processing' | 'events';

const tabs = [
    {
        name: 'Notas de Saída',
        href: '/app/fiscal/nfe'
    },
    {
        name: 'Notas de Entrada',
        href: '/app/fiscal/configuracoes'
    }
];

export default async function NFePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const supabase = await createClient();

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        // Let middleware handle
    }

    // Get company_id
    const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user?.id)
        .single();

    const companyId = member?.company_id;

    // Parse filters
    const rawView = typeof params.view === 'string' ? params.view : 'pending';
    const allowedViews: NfeListView[] = ['pending', 'issued', 'cancelled', 'processing', 'events'];
    const view: NfeListView = allowedViews.includes(rawView as NfeListView)
        ? (rawView as NfeListView)
        : 'pending';
    const dateFrom = (params.dateFrom as string) || undefined;
    const dateTo = (params.dateTo as string) || undefined;
    const clientSearch = (params.clientSearch as string) || undefined;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Notas Fiscais"
                subtitle="Emita NF-e a partir de pedidos ou crie notas avulsas."
                children={<ModuleTabs items={tabs} />}
                actions={
                    <div className="flex gap-2">
                        <Link href="/app/fiscal/nfe/avulsa">
                            <Button variant="secondary" className="font-medium">
                                <Plus className="w-4 h-4 mr-2" /> NF-e Avulsa
                            </Button>
                        </Link>
                        <Button variant="secondary" className="font-medium">
                            <FileText className="w-4 h-4 mr-2" /> Relatório
                        </Button>
                    </div>
                }
            />

            <div className="px-6">
                <InvoiceListClient
                    companyId={companyId!}
                    initialView={view}
                    initialFilters={{
                        dateFrom,
                        dateTo,
                        clientSearch,
                    }}
                />
            </div>
        </div>
    );
}
