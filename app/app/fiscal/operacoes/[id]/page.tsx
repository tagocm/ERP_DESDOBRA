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
        <div className="container mx-auto max-w-[1200px] px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Editar Regra Fiscal</h1>
            <p className="text-gray-500 mb-8">
                Atualize os parâmetros fiscais.
            </p>

            <FiscalOperationForm initialData={data} />
        </div>
    );
}
