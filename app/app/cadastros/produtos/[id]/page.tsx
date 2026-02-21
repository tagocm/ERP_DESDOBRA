"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { ProductForm } from "@/components/products/ProductForm";
import { Loader2 } from "lucide-react";
import type { ProductFormDataDTO } from "@/lib/types/products-dto";
import { buildItemProfileFetchers, fetchItemProfilesForEdit, mapItemAndProfilesToProductFormData } from "@/lib/products/item-edit-loader";

export default function ItemEditPage() {
    const router = useRouter();
    const params = useParams();
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const itemId = params?.id as string;
    const [isLoading, setIsLoading] = useState(true);
    const [initialData, setInitialData] = useState<ProductFormDataDTO | null>(null);

    useEffect(() => {
        if (selectedCompany && itemId) {
            fetchProductData();
        }
    }, [selectedCompany, itemId]);

    const fetchProductData = async () => {
        if (!selectedCompany) {
            return;
        }

        try {
            // Fetch Item
            const { data: item, error: itemError } = await supabase
                .from('items')
                .select('*')
                .eq('id', itemId)
                .eq('company_id', selectedCompany.id)
                .single();

            if (itemError) throw itemError;

            const profiles = await fetchItemProfilesForEdit(buildItemProfileFetchers(supabase, itemId));
            const formData = mapItemAndProfilesToProductFormData(item, profiles);

            setInitialData(formData);

        } catch (error) {
            console.error(error);
            alert("Erro ao carregar dados do item");
            router.push('/app/cadastros/produtos');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
        );
    }

    if (!initialData) return null;

    return (
        <ProductForm
            initialData={initialData}
            isEdit
            itemId={itemId}
        />
    );
}
