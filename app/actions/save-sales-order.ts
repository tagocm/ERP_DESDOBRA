"use server";

import { createClient } from "@supabase/supabase-js";
import { upsertSalesDocument, upsertSalesItem, deleteSalesItem } from "@/lib/data/sales-orders";
import { SalesOrder } from "@/types/sales";

export async function saveSalesOrderAction(
    doc: Partial<SalesOrder>,
    items: any[],
    deletedItemIds: string[],
    userId: string
) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Configuração do servidor incompleta: SUPABASE_URL ou SERVICE_ROLE_KEY faltando.");
        }

        // Create a fresh Admin client for this request to ensure RLS bypass
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
        for (const item of items) {
            // Link item to document
            const itemPayload = { ...item, document_id: savedDoc.id };
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

    } catch (e: any) {
        console.error("Server Action Error:", e);

        // Sanitize Error Message for User
        if (e.message?.includes("new row violates row-level security policy") || e.code === '42501') {
            return { success: false, error: "Falha ao salvar. Verifique permissões de acesso." };
        }

        return { success: false, error: e.message || "Erro desconhecido no servidor." };
    }
}
