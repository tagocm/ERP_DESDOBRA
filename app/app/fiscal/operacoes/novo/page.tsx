"use client";

import { FiscalOperationForm } from "@/components/fiscal/FiscalOperationForm";
import { FiscalOperationDTO } from "@/lib/types/fiscal-types";
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
        <div className="w-full">
            <FiscalOperationForm initialData={initialData} isDuplicate={!!duplicateId} />
        </div>
    );
}
