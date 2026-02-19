import type { SupabaseClient } from "@supabase/supabase-js";

type NfeStatus =
    | "draft"
    | "signed"
    | "processing"
    | "authorized"
    | "cancelled"
    | "denied"
    | "rejected"
    | "error";

type SalesDocumentFiscalStatus = "none" | "authorized" | "cancelled" | "error";

function mapNfeStatusToSalesDocumentFiscalStatus(status: NfeStatus): SalesDocumentFiscalStatus {
    if (status === "authorized") return "authorized";
    // Business rule: cancelled NF-e makes the order re-eligible for new emission.
    if (status === "cancelled") return "none";
    if (status === "denied" || status === "rejected" || status === "error") return "error";
    return "none";
}

export async function syncSalesDocumentFiscalStatus(
    supabaseAdmin: SupabaseClient,
    salesDocumentId: string | null | undefined,
    nfeStatus: NfeStatus,
) {
    if (!salesDocumentId) return;

    const mapped = mapNfeStatusToSalesDocumentFiscalStatus(nfeStatus);

    const { error } = await supabaseAdmin
        .from("sales_documents")
        .update({
            status_fiscal: mapped,
            updated_at: new Date().toISOString(),
        })
        .eq("id", salesDocumentId);

    if (error) {
        throw new Error(`Falha ao sincronizar status_fiscal do pedido: ${error.message}`);
    }
}
