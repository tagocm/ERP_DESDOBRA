"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { ProductForm } from "@/components/products/ProductForm";
import { Loader2 } from "lucide-react";
import { ProductFormData } from "@/types/product";

export default function ItemEditPage() {
    const router = useRouter();
    const params = useParams();
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const itemId = params?.id as string;
    const [isLoading, setIsLoading] = useState(true);
    const [initialData, setInitialData] = useState<ProductFormData | null>(null);

    useEffect(() => {
        if (selectedCompany && itemId) {
            fetchProductData();
        }
    }, [selectedCompany, itemId]);

    const fetchProductData = async () => {
        try {
            // Fetch Item
            const { data: item, error: itemError } = await supabase
                .from('items')
                .select('*')
                .eq('id', itemId)
                .single();

            if (itemError) throw itemError;

            // Fetch Profiles in parallel
            const [inventory, purchase, sales, fiscal, production] = await Promise.all([
                supabase.from('item_inventory_profiles').select('*').eq('item_id', itemId).single().then(r => r.data),
                supabase.from('item_purchase_profiles').select('*').eq('item_id', itemId).single().then(r => r.data),
                supabase.from('item_sales_profiles').select('*').eq('item_id', itemId).single().then(r => r.data),
                supabase.from('item_fiscal_profiles').select('*').eq('item_id', itemId).single().then(r => r.data),
                supabase.from('item_production_profiles').select('*').eq('item_id', itemId).single().then(r => r.data),
            ]);

            // Construct FormData
            const formData: ProductFormData = {
                // Identity
                name: item.name,
                sku: item.sku || "",
                type: item.type as any,
                uom: item.uom,
                is_active: item.is_active,
                gtin_ean_base: item.gtin_ean_base || "",
                net_weight_g_base: item.net_weight_g_base || 0,
                gross_weight_g_base: item.gross_weight_g_base || 0,
                height_base: item.height_base || 0,
                width_base: item.width_base || 0,
                length_base: item.length_base || 0,
                brand: item.brand || "",
                line: item.line || "",
                category_id: item.category_id || undefined,
                description: item.description || "",
                image_url: item.image_url || "",

                // Inventory
                control_stock: inventory?.control_stock ?? true,
                min_stock: inventory?.min_stock ?? undefined,
                max_stock: inventory?.max_stock ?? undefined,
                reorder_point: inventory?.reorder_point ?? undefined,
                default_location: inventory?.default_location || "",
                control_batch: inventory?.control_batch ?? false,
                control_expiry: inventory?.control_expiry ?? false,

                // Purchase
                preferred_supplier_id: purchase?.preferred_supplier_id || undefined,
                lead_time_days: purchase?.lead_time_days ?? undefined,
                purchase_uom: purchase?.purchase_uom || "",
                conversion_factor: purchase?.conversion_factor ?? undefined,
                purchase_notes: purchase?.notes || "",

                // Sales
                is_sellable: sales?.is_sellable ?? true,
                default_price_list_id: sales?.default_price_list_id || undefined,
                default_commission_percent: sales?.default_commission_percent ?? undefined,
                sales_notes: sales?.notes || "",

                // Fiscal
                ncm: fiscal?.ncm || "",
                cest: fiscal?.cest || "",
                origin: fiscal?.origin ?? 0,
                cfop_default: fiscal?.cfop_default || "",
                cfop_code: fiscal?.cfop_code || undefined,
                tax_group_id: fiscal?.tax_group_id || undefined,
                has_fiscal_output: fiscal?.has_fiscal_output ?? false,
                icms_rate: fiscal?.icms_rate ?? undefined,
                ipi_rate: fiscal?.ipi_rate ?? undefined,
                pis_rate: fiscal?.pis_rate ?? undefined,
                cofins_rate: fiscal?.cofins_rate ?? undefined,

                // Packagings (Loaded by Component)
                packagings: [],

                // Production
                is_produced: production?.is_produced ?? false,
                default_bom_id: production?.default_bom_id || undefined,
                batch_size: production?.batch_size ?? undefined,
                production_notes: production?.notes || ""
            };

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
