
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * Retrieves the active company ID for the current authenticated user.
 * Enforces Single Tenant rules:
 * 1. Must be authenticated.
 * 2. Must be a member of the company (RLS check via company_members).
 * 3. In DEV, allows fallback to process.env.NEXT_PUBLIC_DEV_COMPANY_ID if user is member.
 * 
 * Returns the company ID or throws an error.
 */
export async function getActiveCompanyId() {
    const supabase = await createClient();

    // 1. Check Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Unauthorized: User not logged in.");
    }

    // 2. Fetch User's Companies
    const { data: members, error } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("auth_user_id", user.id);

    if (error) {
        throw new Error(`Error fetching company membership: ${error.message}`);
    }

    if (!members || members.length === 0) {
        // Fallback for DEV if configured, but user MUST be in the company? 
        // If data says 0 members, user is in NO company.
        // Unless we decide to bypass RLS for Dev? 
        // User said: "em dev: permitir fallback... se não encontrar, bloquear".
        // This implies if not found in DB, throw error.

        // Wait, if "Fallback to DEV ID", does it mean "Use this ID even if not in DB"?
        // "usuário sem empresa vinculada" -> Error.
        // So user MUST be in DB.
        throw new Error("Usuário sem empresa vinculada.");
    }

    const companyIds = members.map(m => m.company_id);

    // 3. Dev Fallback Priority
    const devId = process.env.NEXT_PUBLIC_DEV_COMPANY_ID;
    const allowDevFallback = process.env.NODE_ENV !== "production";
    if (allowDevFallback && devId && companyIds.includes(devId)) {
        return devId;
    }

    // 4. Default: Return first found (Single Tenant assumption)
    return companyIds[0];
}
