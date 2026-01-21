
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testAuth() {
    console.log("--- Testing Authenticated Access (RLS) ---");

    // 1. Create User via Admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const email = `test_rls_${Date.now()}@example.com`;
    const password = 'password123';

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (createError) { console.error("Create User Error:", createError); return; }
    console.log("Created Test User:", email);

    // 2. Login as User (to get JWT)
    const client = createClient(supabaseUrl, supabaseAnon);
    const { data: sessionData, error: loginError } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) { console.error("Login Error:", loginError); return; }
    console.log("Logged in. User ID:", sessionData.user?.id);

    // 3. Query Deliveries
    const { data: deliveries, error: queryError } = await client
        .from('deliveries')
        .select('id, status')
        .limit(5);

    if (queryError) {
        console.error("Query Error (RLS Block?):", queryError);
    } else {
        console.log(`Query Success! Found ${deliveries?.length} deliveries.`);
        if (deliveries && deliveries.length > 0) {
            console.log("Deliveries found (first 2):", deliveries.slice(0, 2));
        } else {
            console.log("Deliveries array is empty.");
            // Check if service/admin sees them
            const { count } = await adminClient.from('deliveries').select('*', { count: 'exact', head: true });
            console.log(`(Admin sees ${count} total deliveries in DB)`);
        }
    }

    // Cleanup
    await adminClient.auth.admin.deleteUser(userData.user.id);
    console.log("Deleted test user.");
}

testAuth();
