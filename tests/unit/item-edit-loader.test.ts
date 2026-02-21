import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";

import { fetchItemProfilesForEdit, mapItemAndProfilesToProductFormData, type ItemProfileFetchers } from "@/lib/products/item-edit-loader";
import type { Database } from "@/types/supabase";

type ProfileTable = keyof Pick<
    Database["public"]["Tables"],
    | "item_inventory_profiles"
    | "item_purchase_profiles"
    | "item_sales_profiles"
    | "item_fiscal_profiles"
    | "item_production_profiles"
>;

type ProfileResult<T> = {
    data: T | null;
    error: PostgrestError | null;
};

type ProfileResultMap = {
    [K in ProfileTable]: ProfileResult<Database["public"]["Tables"][K]["Row"]>;
};

function createMockProfileFetchers(results: ProfileResultMap): ItemProfileFetchers {
    return {
        inventory: async () => results.item_inventory_profiles,
        purchase: async () => results.item_purchase_profiles,
        sales: async () => results.item_sales_profiles,
        fiscal: async () => results.item_fiscal_profiles,
        production: async () => results.item_production_profiles,
    };
}

function createBaseItem(overrides?: Partial<Database["public"]["Tables"]["items"]["Row"]>): Database["public"]["Tables"]["items"]["Row"] {
    return {
        id: "item-1",
        company_id: "company-1",
        name: "Granola",
        sku: "GRAN-01",
        type: "finished_good",
        uom: "UN",
        uom_id: null,
        is_active: true,
        avg_cost: 0,
        gtin_ean_base: null,
        net_weight_kg_base: null,
        gross_weight_kg_base: null,
        net_weight_g_base: null,
        gross_weight_g_base: null,
        height_base: null,
        width_base: null,
        length_base: null,
        brand: null,
        line: null,
        category_id: null,
        description: null,
        image_url: null,
        packaging_id: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

function createNullProfileResults(): ProfileResultMap {
    return {
        item_inventory_profiles: { data: null, error: null },
        item_purchase_profiles: { data: null, error: null },
        item_sales_profiles: { data: null, error: null },
        item_fiscal_profiles: { data: null, error: null },
        item_production_profiles: { data: null, error: null },
    };
}

describe("item-edit-loader", () => {
    it("retorna null para todos os profiles quando o item não possui linhas ainda", async () => {
        const fetchers = createMockProfileFetchers(createNullProfileResults());

        const profiles = await fetchItemProfilesForEdit(fetchers);

        expect(profiles.inventory).toBeNull();
        expect(profiles.purchase).toBeNull();
        expect(profiles.sales).toBeNull();
        expect(profiles.fiscal).toBeNull();
        expect(profiles.production).toBeNull();
    });

    it("propaga erro real de profile (sem mascarar 406/RLS/etc)", async () => {
        const results = createNullProfileResults();
        results.item_sales_profiles = {
            data: null,
            error: {
                name: "PostgrestError",
                message: "permissão negada",
                code: "42501",
                details: "RLS bloqueou",
                hint: "",
            },
        };
        const fetchers = createMockProfileFetchers(results);

        await expect(fetchItemProfilesForEdit(fetchers)).rejects.toMatchObject({
            code: "42501",
            message: "permissão negada",
        });
    });

    it("gera form data com defaults estáveis quando profiles são nulos", () => {
        const formData = mapItemAndProfilesToProductFormData(createBaseItem(), {
            inventory: null,
            purchase: null,
            sales: null,
            fiscal: null,
            production: null,
        });

        expect(formData.control_stock).toBe(true);
        expect(formData.is_sellable).toBe(true);
        expect(formData.has_fiscal_output).toBe(false);
        expect(formData.is_produced).toBe(false);
    });

    it("valida tipo de item com zod e rejeita valor fora do domínio", () => {
        expect(() =>
            mapItemAndProfilesToProductFormData(createBaseItem({ type: "invalid_type" }), {
                inventory: null,
                purchase: null,
                sales: null,
                fiscal: null,
                production: null,
            }),
        ).toThrow();
    });
});
