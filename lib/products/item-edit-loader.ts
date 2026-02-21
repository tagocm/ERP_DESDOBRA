import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabaseBrowser";
import type { ProductFormDataDTO } from "@/lib/types/products-dto";
import type { Database } from "@/types/supabase";

type ProfileQueryResult<T> = {
    data: T | null;
    error: PostgrestError | null;
};

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type ItemProfileFetchers = {
    inventory: () => PromiseLike<ProfileQueryResult<Database["public"]["Tables"]["item_inventory_profiles"]["Row"]>>;
    purchase: () => PromiseLike<ProfileQueryResult<Database["public"]["Tables"]["item_purchase_profiles"]["Row"]>>;
    sales: () => PromiseLike<ProfileQueryResult<Database["public"]["Tables"]["item_sales_profiles"]["Row"]>>;
    fiscal: () => PromiseLike<ProfileQueryResult<Database["public"]["Tables"]["item_fiscal_profiles"]["Row"]>>;
    production: () => PromiseLike<ProfileQueryResult<Database["public"]["Tables"]["item_production_profiles"]["Row"]>>;
};

export type ItemEditProfiles = {
    inventory: Database["public"]["Tables"]["item_inventory_profiles"]["Row"] | null;
    purchase: Database["public"]["Tables"]["item_purchase_profiles"]["Row"] | null;
    sales: Database["public"]["Tables"]["item_sales_profiles"]["Row"] | null;
    fiscal: Database["public"]["Tables"]["item_fiscal_profiles"]["Row"] | null;
    production: Database["public"]["Tables"]["item_production_profiles"]["Row"] | null;
};

const itemTypeSchema = z.enum(["raw_material", "packaging", "wip", "finished_good", "service", "other"]);

async function unwrapOptionalProfile<T>(query: PromiseLike<ProfileQueryResult<T>>): Promise<T | null> {
    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
}

export function buildItemProfileFetchers(supabase: SupabaseBrowserClient, itemId: string): ItemProfileFetchers {
    return {
        inventory: () =>
            supabase
                .from("item_inventory_profiles")
                .select("*")
                .eq("item_id", itemId)
                .maybeSingle(),
        purchase: () =>
            supabase
                .from("item_purchase_profiles")
                .select("*")
                .eq("item_id", itemId)
                .maybeSingle(),
        sales: () =>
            supabase
                .from("item_sales_profiles")
                .select("*")
                .eq("item_id", itemId)
                .maybeSingle(),
        fiscal: () =>
            supabase
                .from("item_fiscal_profiles")
                .select("*")
                .eq("item_id", itemId)
                .maybeSingle(),
        production: () =>
            supabase
                .from("item_production_profiles")
                .select("*")
                .eq("item_id", itemId)
                .maybeSingle(),
    };
}

export async function fetchItemProfilesForEdit(fetchers: ItemProfileFetchers): Promise<ItemEditProfiles> {
    const [inventory, purchase, sales, fiscal, production] = await Promise.all([
        unwrapOptionalProfile(fetchers.inventory()),
        unwrapOptionalProfile(fetchers.purchase()),
        unwrapOptionalProfile(fetchers.sales()),
        unwrapOptionalProfile(fetchers.fiscal()),
        unwrapOptionalProfile(fetchers.production()),
    ]);

    return {
        inventory,
        purchase,
        sales,
        fiscal,
        production,
    };
}

export function mapItemAndProfilesToProductFormData(
    item: Database["public"]["Tables"]["items"]["Row"],
    profiles: ItemEditProfiles,
): ProductFormDataDTO {
    const itemType = itemTypeSchema.parse(item.type);

    return {
        name: item.name,
        sku: item.sku ?? "",
        type: itemType,
        uom: item.uom,
        uom_id: item.uom_id ?? undefined,
        is_active: item.is_active,
        gtin_ean_base: item.gtin_ean_base ?? "",
        net_weight_kg_base: item.net_weight_kg_base ?? 0,
        gross_weight_kg_base: item.gross_weight_kg_base ?? 0,
        height_base: item.height_base ?? 0,
        width_base: item.width_base ?? 0,
        length_base: item.length_base ?? 0,
        brand: item.brand ?? "",
        line: item.line ?? "",
        category_id: item.category_id ?? undefined,
        description: item.description ?? "",
        image_url: item.image_url ?? "",
        control_stock: profiles.inventory?.control_stock ?? true,
        min_stock: profiles.inventory?.min_stock ?? undefined,
        max_stock: profiles.inventory?.max_stock ?? undefined,
        reorder_point: profiles.inventory?.reorder_point ?? undefined,
        default_location: profiles.inventory?.default_location ?? "",
        control_batch: profiles.inventory?.control_batch ?? false,
        control_expiry: profiles.inventory?.control_expiry ?? false,
        preferred_supplier_id: profiles.purchase?.preferred_supplier_id ?? undefined,
        lead_time_days: profiles.purchase?.lead_time_days ?? undefined,
        purchase_uom: profiles.purchase?.purchase_uom ?? "",
        purchase_uom_id: profiles.purchase?.purchase_uom_id ?? undefined,
        default_purchase_packaging_id: profiles.purchase?.default_purchase_packaging_id ?? undefined,
        conversion_factor: profiles.purchase?.conversion_factor ?? undefined,
        purchase_notes: profiles.purchase?.notes ?? "",
        is_sellable: profiles.sales?.is_sellable ?? true,
        default_price_list_id: profiles.sales?.default_price_list_id ?? undefined,
        default_commission_percent: profiles.sales?.default_commission_percent ?? undefined,
        sales_notes: profiles.sales?.notes ?? "",
        ncm: profiles.fiscal?.ncm ?? "",
        cest: profiles.fiscal?.cest ?? "",
        origin: profiles.fiscal?.origin ?? 0,
        cfop_default: profiles.fiscal?.cfop_default ?? "",
        cfop_code: profiles.fiscal?.cfop_code ?? undefined,
        tax_group_id: profiles.fiscal?.tax_group_id ?? undefined,
        has_fiscal_output: profiles.fiscal?.has_fiscal_output ?? false,
        icms_rate: profiles.fiscal?.icms_rate ?? undefined,
        ipi_rate: profiles.fiscal?.ipi_rate ?? undefined,
        pis_rate: profiles.fiscal?.pis_rate ?? undefined,
        cofins_rate: profiles.fiscal?.cofins_rate ?? undefined,
        packagings: [],
        is_produced: profiles.production?.is_produced ?? false,
        default_bom_id: profiles.production?.default_bom_id ?? undefined,
        batch_size: profiles.production?.batch_size ?? undefined,
        production_uom_id: profiles.production?.production_uom_id ?? undefined,
        production_uom: profiles.production?.production_uom ?? undefined,
        loss_percent: profiles.production?.loss_percent ?? undefined,
        production_notes: profiles.production?.notes ?? "",
        byproducts: [],
    };
}
