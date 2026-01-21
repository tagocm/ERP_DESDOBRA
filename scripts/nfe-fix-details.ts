
import dotenv from 'dotenv';
import path from 'path';

// Load env BEFORE imports
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const supabase = createAdminClient();

    console.log('Scanning sales_document_nfes for corrupted details...');

    const { data: records, error } = await supabase
        .from('sales_document_nfes')
        .select('id, details');

    if (error) {
        console.error('Error fetching records:', error);
        process.exit(1);
    }

    let fixedCount = 0;

    for (const rec of records) {
        const details = rec.details;

        if (!details || typeof details !== 'object') continue;

        // Check for "char map" pattern (keys "0", "1", "2"...)
        // Valid object should have keys like "stage", "chNFe" etc.
        // If it looks like an array-like object but isn't an array (it's a JSON object due to migration)
        const keys = Object.keys(details);
        const hasIndexKeys = '0' in details && '1' in details;

        if (hasIndexKeys) {
            console.log(`Found corrupted record: ${rec.id}`);

            try {
                // Identify all numeric keys
                const numericKeys = keys.filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));

                // Reconstruct string from numeric keys
                let reconstructed = '';
                for (const k of numericKeys) {
                    reconstructed += details[k];
                }

                console.log(`- Reconstructed string (len ${reconstructed.length}): ${reconstructed.substring(0, 50)}...`);

                let parsedOldDetails = {};
                try {
                    parsedOldDetails = JSON.parse(reconstructed);
                } catch (e) {
                    // If it's not valid JSON, it might be a plain string message
                    console.warn(`- Reconstructed content is not JSON: "${reconstructed}". Saving as 'legacy_message'.`);
                    parsedOldDetails = { legacy_message: reconstructed };
                }

                // Create clean object: start with current details (excluding numeric keys), merge parsed old details
                // actually, the current details.stage is "SIGNED_OFFLINE" (newer), so we prioritize current details over parsed old.
                const cleanDetails = { ...details };

                // Remove numeric keys
                for (const k of numericKeys) {
                    delete cleanDetails[k];
                }

                const mergedDetails = {
                    ...parsedOldDetails,
                    ...cleanDetails
                };

                // Update
                const { error: updateError } = await supabase
                    .from('sales_document_nfes')
                    .update({ details: mergedDetails })
                    .eq('id', rec.id);

                if (updateError) {
                    console.error(`- Failed to update: ${updateError.message}`);
                } else {
                    console.log(`- Fixed successfully.`);
                    fixedCount++;
                }

            } catch (err) {
                console.error(`- Error processing corrupted record:`, err);
            }
        }
    }

    console.log(`Done. Fixed ${fixedCount} records.`);
}

main().catch(console.error);
