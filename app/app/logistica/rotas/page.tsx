import { createClient } from "@/utils/supabase/server";
import { ExpeditionPageClient } from "@/components/expedition/ExpeditionPageClient";

export default async function ExpeditionPage() {
    const supabase = await createClient();

    // Get company from session securely on server side
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="p-8 text-center text-red-600">
                Sessão não encontrada.
            </div>
        );
    }

    let companyId = user.user_metadata?.company_id;

    // Fallback: fetch from DB if metadata is corrupt
    if (!companyId) {
        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .limit(1)
            .single();

        if (member) {
            companyId = member.company_id;
        }
    }

    if (!companyId) {
        return (
            <div className="p-8 text-center text-red-600">
                Empresa não identificada. Por favor contate o suporte.
            </div>
        );
    }

    return <ExpeditionPageClient companyId={companyId} />;
}
