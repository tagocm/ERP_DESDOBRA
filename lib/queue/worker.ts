
import { createAdminClient } from '@/lib/supabaseServer';

// Fallback Type Definition (until types/supabase.ts is updated)
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
    id: string;
    job_type: string;
    payload: any; // JSONB
    status: JobStatus;
    attempts: number;
    max_attempts: number;
    last_error?: string | null;
    created_at: string;
    updated_at: string;
    scheduled_for: string;
}

export interface WorkerOptions {
    pollIntervalMs?: number;
    jobType: string;
}

export class JobWorker {
    private isRunning: boolean = false;
    private pollIntervalMs: number;
    private jobType: string;

    constructor(options: WorkerOptions) {
        this.pollIntervalMs = options.pollIntervalMs || 5000;
        this.jobType = options.jobType;
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[Worker:${this.jobType}] Started polling...`);
        this.loop();
    }

    stop() {
        this.isRunning = false;
        console.log(`[Worker:${this.jobType}] Identifying stop signal...`);
    }

    private async loop() {
        while (this.isRunning) {
            try {
                // Fetch next job (atomic)
                const job = await this.fetchNextJob();

                if (job) {
                    // Process immediately
                    console.log(`[Worker:${this.jobType}] Processing Job ${job.id} (Attempt ${job.attempts}/${job.max_attempts})`);
                    await this.processJob(job);
                } else {
                    // Idle - Wait before next poll
                    await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
                }
            } catch (error) {
                console.error(`[Worker:${this.jobType}] Critical Loop Error:`, error);
                // Wait a bit to avoid hot loop on error
                await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
            }
        }
        console.log(`[Worker:${this.jobType}] Loop stopped.`);
    }

    private async fetchNextJob(): Promise<Job | null> {
        const supabase = createAdminClient();

        const { data, error } = await supabase.rpc('fetch_next_job', {
            p_job_type: this.jobType
        });

        if (error) {
            console.error(`[Worker:${this.jobType}] Fetch Error:`, error);
            return null;
        }

        if (data && data.length > 0) {
            return data[0] as Job;
        }

        return null; // Empty queue
    }

    private async processJob(job: Job) {
        const supabase = createAdminClient();

        try {
            // --- HANDLER LOGIC (Can be extracted to a strategy pattern later) ---
            await this.handleJobLogic(job);

            // Success
            await supabase.from('jobs_queue').update({
                status: 'completed',
                updated_at: new Date().toISOString()
            }).eq('id', job.id);

            console.log(`[Worker:${this.jobType}] Job ${job.id} COMPLETED.`);

        } catch (err: any) {
            // Failure
            console.error(`[Worker:${this.jobType}] Job ${job.id} FAILED: ${err.message}`);

            const nextStatus = job.attempts >= job.max_attempts ? 'failed' : 'pending';

            // Calculate backoff if retrying (Exponential: 1m, 2m, 4m...)
            let nextSchedule = new Date();
            if (nextStatus === 'pending') {
                const backoffMinutes = Math.pow(2, job.attempts); // 2^1=2, 2^2=4...
                nextSchedule.setMinutes(nextSchedule.getMinutes() + backoffMinutes);
            }

            await supabase.from('jobs_queue').update({
                status: nextStatus,
                last_error: err.message || 'Unknown Error',
                scheduled_for: nextStatus === 'pending' ? nextSchedule.toISOString() : job.scheduled_for,
                updated_at: new Date().toISOString()
            }).eq('id', job.id);
        }
    }

    private async handleJobLogic(job: Job) {
        if (this.jobType === 'NFE_EMIT') {
            // Dynamic import to avoid potential circular massive imports on startup if we add more types
            const { emitOffline } = await import('@/lib/fiscal/nfe/offline/emitOffline');

            // Validate Payload
            const { orderId, companyId } = job.payload;
            if (!orderId || !companyId) {
                // This will fail the job and trigger retries (or fail immediately if we throw a specific NonRetriableError?)
                // For now, simple Error
                throw new Error(`Invalid payload for NFE_EMIT: Missing orderId or companyId`);
            }

            console.log(`[Worker] Emitting NFe for Order ${orderId}...`);

            // Calls the core logic we analyzed earlier
            // transmit=true means it will try to send to SEFAZ if configured
            const result = await emitOffline(orderId, companyId, true);

            if (!result.success) {
                // If it failed, throw error to trigger retry mechanism in processJob
                throw new Error(result.message || 'Falha desconhecida na emissão via emitOffline');
            }

            console.log(`[Worker] Emission Success: ${result.status} - ${result.message}`);

        } else {
            console.warn(`[Worker] No handler for job type: ${this.jobType}`);
        }
    }
}
