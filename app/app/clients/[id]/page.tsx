"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ClientDetailRedirect() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    useEffect(() => {
        if (id) {
            router.replace(`/app/cadastros/pessoas-e-empresas/${id}`);
        }
    }, [router, id]);

    return (
        <div className="p-8 text-center">
            <p>Redirecionando...</p>
        </div>
    );
}
