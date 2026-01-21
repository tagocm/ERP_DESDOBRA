
import { createAdminClient } from '@/lib/supabaseServer';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const supabase = createAdminClient();
    const GOOD_ID = 'b826b0d1-bee5-4d47-bef3-a70a064a6569';

    console.log('--- Company Members (Good Company) ---');
    const { data: members } = await supabase.from('company_members').select('*').eq('company_id', GOOD_ID);
    console.log(JSON.stringify(members, null, 2));

    console.log('\n--- Auth Users (via Admin) ---');
    const { data: { users: authUsers }, error: authErr } = await supabase.auth.admin.listUsers();

    if (authErr) {
        console.error('Error fetching auth users:', authErr);
        return;
    }

    // Filter for our likely dev/test user
    const targetUser = authUsers.find(u => u.email?.includes('admin') || u.email?.includes('desdobra'));

    if (targetUser) {
        console.log(`Found Target Auth User: ${targetUser.email} (ID: ${targetUser.id})`);

        // Check if member exists
        const { data: mem } = await supabase
            .from('company_members')
            .select('*')
            .eq('company_id', GOOD_ID)
            .eq('auth_user_id', targetUser.id)
            .maybeSingle();

        if (!mem) {
            console.log(`Creating missing membership for ${targetUser.email}...`);
            const { error: insErr } = await supabase.from('company_members').insert({
                company_id: GOOD_ID,
                auth_user_id: targetUser.id,
                role: 'owner'
            });
            if (insErr) console.error('Failed to insert member:', insErr);
            else console.log('Membership created successfully.');
        } else {
            console.log('Membership already exists for this user.');
        }

    } else {
        console.log('Target user not found in Auth Users.');
        console.log('Available emails:', authUsers.map(u => u.email));
    }
}

main();
