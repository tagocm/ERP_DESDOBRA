
import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient } from '@/lib/supabaseServer';

// Load .env.local manually
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach((line) => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const val = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
                process.env[key] = val;
            }
        });
        console.log("Loaded .env.local");
    } else {
        console.warn(".env.local not found at", envPath);
    }
} catch (e) {
    console.error("Failed to load .env.local", e);
}

async function auditEvent() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing Supabase env vars");
        return;
    }

    const supabase = await createAdminClient();

    console.log("Searching for event 'Pedido #113'...");

    // Try to find by origin reference
    let { data: events, error } = await supabase
        .from('financial_events')
        .select(`
      *,
      installments:financial_event_installments(*)
    `)
        .ilike('origin_reference', '%#113%')
        .limit(5);

    if (error) {
        console.error("Error fetching events:", error);
        return;
    }

    if (!events || events.length === 0) {
        console.log("No exact match for #113. Listing recent pending events...");
        const { data: recent } = await supabase
            .from('financial_events')
            .select('id, origin_reference, partner_name, total_amount, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
        console.table(recent);
        return;
    }

    const targetEvent = events[0];
    console.log(`Found Event: ${targetEvent.id}`);
    console.log(`Reference: ${targetEvent.origin_reference}`);
    console.log(`Partner: ${targetEvent.partner_name}`);
    console.log(`Payment Term (Event Level):`, targetEvent.payment_term_id || 'N/A');

    console.log("\n--- Installments Data ---");
    if (targetEvent.installments && targetEvent.installments.length > 0) {
        // Check consistency
        const uniqueConditions = new Set(targetEvent.installments.map(i => i.payment_condition));
        const uniqueMethods = new Set(targetEvent.installments.map(i => i.payment_method));
        const uniqueAccounts = new Set(targetEvent.installments.map(i => i.financial_account_id));
        const uniqueGLs = new Set(targetEvent.installments.map(i => i.suggested_account_id));
        const uniqueCCs = new Set(targetEvent.installments.map(i => i.cost_center_id));

        console.log("Consistency Check:");
        console.log(`Payment Conditions: ${uniqueConditions.size} unique values (${Array.from(uniqueConditions).join(', ')})`);
        console.log(`Payment Methods: ${uniqueMethods.size} unique values (${Array.from(uniqueMethods).join(', ')})`);
        console.log(`Financial Accounts: ${uniqueAccounts.size} unique values (${Array.from(uniqueAccounts).join(', ')})`);
        console.log(`GL Accounts: ${uniqueGLs.size} unique values (${Array.from(uniqueGLs).join(', ')})`);
        console.log(`Cost Centers: ${uniqueCCs.size} unique values (${Array.from(uniqueCCs).join(', ')})`);

        console.table(targetEvent.installments.map(i => ({
            num: i.installment_number,
            amount: i.amount,
            due_date: i.due_date,
            cond: i.payment_condition,
            method: i.payment_method,
            account: i.financial_account_id,
            gl: i.suggested_account_id,
            cc: i.cost_center_id
        })));
    } else {
        console.log("No installments found.");
    }
}

auditEvent().catch(console.error);
