
import { createClient } from "@/utils/supabase/server";
import { getUnscheduledRoutes } from "@/lib/data/expedition";

export default async function Page() {
    const supabase = await createClient();

    // Hardcoded companyId or fetch the first one?
    // Let's assume user is logged in or just use a known company ID if possible.
    // Actually, running this as a script might be harder with RLS.
    // I'll make a temporary page to inspect specific data.

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return <div>Not logged in</div>;

    const companyId = user.user_metadata.company_id || 'ec3ca228-4228-4ce3-b903-a44d8471534b'; // Fallback or current

    const routes = await getUnscheduledRoutes(supabase, companyId);

    return (
        <div className="p-10 whitespace-pre-wrap font-mono text-xs">
            {JSON.stringify(routes, null, 2)}
        </div>
    );
}
