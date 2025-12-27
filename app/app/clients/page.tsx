"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/app/cadastros/pessoas-e-empresas");
    }, [router]);

    return (
        <div className="p-8 text-center">
            <p>Redirecionando...</p>
        </div>
    );
}
