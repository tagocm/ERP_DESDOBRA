"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PipelineKanban } from '@/components/crm/PipelineKanban';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { PageHeader } from "@/components/ui/PageHeader";

export default function CRMPage() {
    const router = useRouter();
    // HeaderContext removed

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pipeline CRM"
                subtitle="Gerencie seus negócios e oportunidades"
                actions={
                    <Button onClick={() => router.push('/app/crm/new')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Negócio
                    </Button>
                }
            />
            <PipelineKanban />
        </div>
    );
}
