import { createClient } from "@/utils/supabase/server";

type CompanyContext = {
    supabase: Awaited<ReturnType<typeof createClient>>;
    companyId: string;
    userId: string;
};

export async function resolveCompanyContext(): Promise<CompanyContext> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("Unauthorized");
    }

    const { data: members, error: membersError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("auth_user_id", user.id);

    if (membersError) {
        throw new Error(`Error fetching company membership: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
        throw new Error("No company found");
    }

    const devId = process.env.NEXT_PUBLIC_DEV_COMPANY_ID;
    if (devId && members.some(member => member.company_id === devId)) {
        return { supabase, companyId: devId, userId: user.id };
    }

    return { supabase, companyId: members[0].company_id, userId: user.id };
}
