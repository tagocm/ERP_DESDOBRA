
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserCompany() {
    console.log('--- Fixing User Company Association ---');

    // 1. Get the user (either from argument or default to tiago.martini@me.com)
    const targetEmail = process.argv[2] || 'tiago.martini@me.com';
    console.log(`Target User Email: ${targetEmail}`);

    // We can't query auth.users directly with the JS client usually, unless we use the admin api
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('Error listing users:', userError);
        return;
    }

    const user = users.find(u => u.email === targetEmail);

    if (!user) {
        console.error(`User ${targetEmail} not found in auth.users`);
        console.log('Available users:', users.map(u => u.email));
        return;
    }

    console.log(`Found User ID: ${user.id}`);

    // 2. Get the target company (Campinas or First found)
    const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('*');

    if (companyError) {
        console.error('Error listing companies:', companyError);
        return;
    }

    if (!companies || companies.length === 0) {
        console.error('No companies found in database. Please seed companies first.');
        return;
    }

    // Prefer 'Desdobra Campinas' or 'Matriz'
    let targetCompany = companies.find(c => c.trade_name?.includes('Campinas'))
        || companies.find(c => c.trade_name?.includes('Matriz'))
        || companies[0];

    console.log(`Selected Target Company: ${targetCompany.trade_name} (${targetCompany.id})`);

    // 3. Create or Update Company Member Link
    // Check if already member
    const { data: existingMember, error: memberError } = await supabase
        .from('company_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', targetCompany.id)
        .single();

    if (existingMember) {
        console.log('User is already a member of this company.');
    } else {
        console.log('Adding user to company_members...');
        const { error: insertError } = await supabase
            .from('company_members')
            .insert({
                company_id: targetCompany.id,
                auth_user_id: user.id,
                role: 'owner' // Give full access
            });

        if (insertError) {
            console.error('Error adding user to company:', insertError);
            return;
        }
        console.log('✅ User successfully added to company.');
    }

    // 4. Also Ensure Public User Profile Exists (if needed)
    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        console.log('Creating public user profile...');
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: user.id,
                email: user.email,
                full_name: 'Test User',
                role: 'admin' // If applicable
            });

        if (profileError) console.error('Error creating profile:', profileError);
        else console.log('✅ Public profile created.');
    }

    console.log('--- Fix Complete ---');
}

fixUserCompany();
