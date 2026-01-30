
import { JobWorker } from '../lib/queue/worker';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('--- NFe Worker Starting ---');
    console.log('Environment:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Loaded' : 'Missing');

    // We can run multiple workers for different types if needed
    // For now, just NFE_EMIT
    const worker = new JobWorker({
        jobType: 'NFE_EMIT',
        pollIntervalMs: 2000 // Poll every 2 seconds
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('SIGINT received. Stopping worker...');
        worker.stop();
        setTimeout(() => process.exit(0), 1000);
    });

    await worker.start();
}

main().catch(err => {
    console.error('Fatal Worker Error:', err);
    process.exit(1);
});
