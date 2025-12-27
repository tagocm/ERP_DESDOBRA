"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { PriceTableForm } from "@/components/commercial/PriceTableForm";
import { getPriceTableById, PriceTable } from "@/lib/price-tables";
import { Loader2 } from "lucide-react";

export default function EditPriceTablePage() {
    const params = useParams();
    const id = params.id as string;
    const supabase = createClient();

    const [table, setTable] = useState<PriceTable | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadTable();
        }
    }, [id]);

    const loadTable = async () => {
        try {
            const data = await getPriceTableById(supabase, id);
            setTable(data);
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar tabela.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    if (!table) {
        return <div>Não encontrado.</div>;
    }

    return <PriceTableForm initialData={table} isEdit={true} />;
}
