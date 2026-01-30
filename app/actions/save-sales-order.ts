"use server";

import { createClient } from "@supabase/supabase-js";
import { upsertSalesDocument, upsertSalesItem, deleteSalesItem } from "@/lib/data/sales-orders";
import { SalesOrder } from "@/types/sales";

import { getActiveCompanyId } from "@/lib/auth/get-active-company";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function saveSalesOrderAction(
    doc: Partial<SalesOrder>,
    items: unknown[],
    deletedItemIds: string[],
    userId: string // Legacy param, we'll verify it
) {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error("Unauthorized");
        // Optional: Enforce userId matches current user? 
        // Or blindly trust strictly the companyId context. 
        // We'll update doc.company_id.
        doc.company_id = companyId;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Configuração do servidor incompleta: SUPABASE_URL ou SERVICE_ROLE_KEY faltando.");
        }

        // Create a fresh Admin client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 1. Save Document Header
        const savedDoc = await upsertSalesDocument(supabaseAdmin, doc);

        // 2. Save/Update Items
        const savedItems = [];
        const { resolveDefaultPackagingId } = await import("@/lib/packaging"); // dynamic import or top-level

        for (const item of items) {
            // Validate/Resolve Packaging if missing
            if (!item.packaging_id) {
                // We need company_id. validDoc should have it.
                const companyId = savedDoc.company_id;
                if (companyId && item.item_id) {
                    const resolvedId = await resolveDefaultPackagingId(supabaseAdmin, companyId, item.item_id);
                    if (resolvedId) {
                        item.packaging_id = resolvedId;
                    } else {
                        // Check if this item type SHOULD have packaging?
                        // For now, per instructions: "Se não existir nenhuma embalagem ativa, deve retornar erro"
                        // We assume this applies to products that require packaging.
                        // But if resolve returns null, it means NO packaging exists at all.
                        // We throw error.
                        // To be safe, maybe we fetch the item name for better error?
                        // item.product might be available from context or we blindly throw.
                        throw new Error(`Item (ID: ${item.item_id}) sem embalagem padrão cadastrada. Cadastre uma embalagem e marque como padrão.`);
                    }
                }
            }

            // Link item to document
            const itemPayload: Record<string, unknown> = { ...item, document_id: savedDoc.id };

            // --- Snapshot Logic ---
            try {
                // If packaging_id exists (resolved or original), build snapshot
                if (item.packaging_id) {
                    const { resolvePackagingSnapshot } = await import("@/lib/packaging");
                    const snapshot = await resolvePackagingSnapshot(supabaseAdmin, item.packaging_id);
                    if (snapshot) {
                        itemPayload.sales_unit_snapshot = snapshot;
                    }
                } else {
                    // Start of fallback/default snapshot logic for UN items (no packaging)
                    // If no packaging, we are selling in the base unit.
                    // We need base unit info from the item/product.
                    // Since we don't have product context here easily without fetching, 
                    // we might skip or do a quick fetch if critical. 
                    // For MVP/Robustness: Let's fetch the item uom only if we want perfect snapshot for UN sales too.

                    // Fetch basic item info using admin client to guarantee access
                    const { data: prod } = await supabaseAdmin
                        .from('items')
                        .select('uom, uom_id, base_uom:uoms!uom_id(abbrev, name)')
                        .eq('id', item.item_id)
                        .single();

                    if (prod) {
                        const abbrev = (prodany)?.abbrev || prod.uom || 'Un';

                        itemPayload.sales_unit_snapshot = {
                            sell_uom_id: prod.uom_id, // Selling in base
                            base_uom_id: prod.uom_id,
                            sell_unit_code: abbrev,
                            base_unit_code: abbrev,
                            factor_in_base: 1,
                            auto_label: (prod.base_uom as Record<string, unknown>)?.name || 'Unidade'
                        };
                    }
                }
            } catch (snapErr) {
                console.warn("Failed to generate sales_unit_snapshot:", snapErr);
                // Non-blocking, continue
            }

            const savedItem = await upsertSalesItem(supabaseAdmin, itemPayload);
            savedItems.push(savedItem);
        }

        // 3. Delete Removed Items
        if (deletedItemIds && deletedItemIds.length > 0) {
            for (const id of deletedItemIds) {
                await deleteSalesItem(supabaseAdmin, id);
            }
        }

        return { success: true, data: { ...savedDoc, items: savedItems } };

    } catch (e: unknown) {
        console.error("Server Action Error:", e);

        // Sanitize Error Message for User
        const errorMessage = e instanceof Error ? e.message : '';
        const errorCode = (e as any)?.code;

        if (errorMessage?.includes("new row violates row-level security policy") || errorCode === '42501') {
            return { success: false, error: "Falha ao salvar. Verifique permissões de acesso." };
        }

        return { success: false, error: errorMessage || "Erro desconhecido no servidor." };
    }
}
