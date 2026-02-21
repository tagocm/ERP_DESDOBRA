
import { JobWorker } from '../lib/queue/worker';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('--- NFe Worker Starting ---');
    console.log('Environment:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Loaded' : 'Missing');

    const workers = [
        new JobWorker({
            jobType: 'NFE_EMIT',
            pollIntervalMs: 2000,
            maxPollIntervalMs: 30000,
            backoffMultiplier: 2
        }),
        new JobWorker({
            jobType: 'NFE_CCE',
            pollIntervalMs: 2000,
            maxPollIntervalMs: 30000,
            backoffMultiplier: 2
        }),
        new JobWorker({
            jobType: 'NFE_CANCEL',
            pollIntervalMs: 2000,
            maxPollIntervalMs: 30000,
            backoffMultiplier: 2
        })
    ];

    console.log('Worker polling strategy: min=2s, max=30s, backoff=2x, jitter=0-25%');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('SIGINT received. Stopping worker...');
        workers.forEach((worker) => worker.stop());
        setTimeout(() => process.exit(0), 1000);
    });

    await Promise.all(workers.map((worker) => worker.start()));
}

main().catch(err => {
    console.error('Fatal Worker Error:', err);
    process.exit(1);
});
