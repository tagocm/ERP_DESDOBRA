import { createClient } from "@/utils/supabase/server";
import { getExpeditionRoutes } from "@/lib/data/expedition";
import { format } from "date-fns";
import { ExpedicaoClient } from "@/components/expedicao/ExpedicaoClient";

export default async function ExpedicaoSeparacaoPage() {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="p-8 text-center text-red-600">
                Sessão não encontrada. Por favor, faça login novamente.
            </div>
        );
    }

    let companyId = user.user_metadata?.company_id;

    // Fallback: fetch from DB if metadata is invalid or missing associated company
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
                Empresa não identificada no usuário.
            </div>
        );
    }

    try {
        // Get routes for expanded range (Today + 14 days) to support client-side filtering
        const today = new Date();
        const dateFrom = format(today, 'yyyy-MM-dd');
        const dateTo = format(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

        const routes = await getExpeditionRoutes(supabase, companyId, {
            dateFrom,
            dateTo
        });

        return <ExpedicaoClient initialRoutes={routes || []} />;
    } catch (error: any) {
        console.error("Erro ao carregar expedição:", error);
        return (
            <div className="p-8 text-center text-red-600">
                <h3 className="font-bold">Erro ao carregar dados</h3>
                <p>{error.message}</p>
            </div>
        );
    }
}
