"use client";

import { FiscalOperationForm } from "@/components/fiscal/FiscalOperationForm";
import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";

export default function EditFiscalOperationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [data, setData] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        if (id) {
            supabase.from('fiscal_operations').select('*').eq('id', id).single()
                .then(({ data }) => {
                    if (data) setData(data);
                });
        }
    }, [id]);

    if (!data) return <div className="p-8">Carregando...</div>;

    return (
        <div className="w-full">
            <FiscalOperationForm initialData={data} />
        </div>
    );
}
