"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NewPaymentTermPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to list since creation might be a modal or not implemented yet
        router.replace("/app/cadastros/condicoes-de-pagamento");
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full w-full">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
    );
}
