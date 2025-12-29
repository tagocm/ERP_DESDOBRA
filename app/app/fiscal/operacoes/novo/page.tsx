"use client";

import { FiscalOperationForm } from "@/components/fiscal/FiscalOperationForm";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

export default function NewFiscalOperationPage() {
    const searchParams = useSearchParams();
    const duplicateId = searchParams.get('duplicate');
    const [initialData, setInitialData] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        if (duplicateId) {
            supabase.from('fiscal_operations').select('*').eq('id', duplicateId).single()
                .then(({ data }) => {
                    if (data) setInitialData(data);
                });
        }
    }, [duplicateId]);

    return (
        <div className="container mx-auto max-w-[1200px] px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {duplicateId ? "Duplicar Regra Fiscal" : "Nova Regra Fiscal"}
            </h1>
            <p className="text-gray-500 mb-8">
                Defina os parâmetros para cálculo automático de impostos.
            </p>

            <FiscalOperationForm initialData={initialData} isDuplicate={!!duplicateId} />
        </div>
    );
}
