import { createClient } from '@/utils/supabase/server';

export async function runManualQuery() {
    const supabase = await createClient();

    // Example: Query the stuck emission
    const accessKey = '35260103845616000108550010000000031234567890'; // Replace with actual key from UI
    const companyId = 'your-company-id'; // Replace with actual company ID

    const response = await fetch('http://localhost:3000/api/nfe/query-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey, companyId })
    });

    const result = await response.json();
    console.log('Query Result:', result);
}

// To run this helper:
// npx tsx scripts/query-stuck-nfe.ts
runManualQuery().catch(console.error);
