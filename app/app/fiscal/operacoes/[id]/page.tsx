"use client";

import { FiscalOperationForm } from "@/components/fiscal/FiscalOperationForm";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";

export default function EditFiscalOperationPage({ params }: { params: { id: string } }) {
    const [data, setData] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        if (params.id) {
            supabase.from('fiscal_operations').select('*').eq('id', params.id).single()
                .then(({ data }) => {
                    if (data) setData(data);
                });
        }
    }, [params.id]);

    if (!data) return <div className="p-8">Carregando...</div>;

    return (
        <div className="w-full">
            <FiscalOperationForm initialData={data} />
        </div>
    );
}
