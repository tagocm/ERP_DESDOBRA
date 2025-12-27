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

        console.log("SERVER ACTION DEBUG:");
        console.log("URL:", supabaseUrl);
        console.log("Service Key Present:", !!supabaseServiceRoleKey);
        console.log("Service Key Length:", supabaseServiceRoleKey?.length);
        console.log("Service Key Start:", supabaseServiceRoleKey?.substring(0, 10));

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

    } catch (e: any) {
        console.error("Server Action Error:", e);

        // Sanitize Error Message for User
        if (e.message?.includes("new row violates row-level security policy") || e.code === '42501') {
            return { success: false, error: "Falha ao salvar. Verifique permissões de acesso." };
        }

        return { success: false, error: e.message || "Erro desconhecido no servidor." };
    }
}
