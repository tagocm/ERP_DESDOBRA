
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables. Check .env.local");
    process.exit(1);
}

// Type definitions based on our schema
type Job = Database['public']['Tables']['jobs_queue']['Row'];

export class JobWorker {
    private supabase: SupabaseClient<Database>;
    private isRunning: boolean = false;
    private readonly MAX_ATTEMPTS = 3;
    private readonly POLLING_INTERVAL_MS = 5000;

    constructor() {
        this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
    }

    public async start() {
        this.isRunning = true;
        console.log("🚀 JobWorker started. Listening for jobs...");

        while (this.isRunning) {
            try {
                await this.poll();
            } catch (error: any) {
                console.error("💥 Worker loop crashed (restarting in 5s):", error.message);
                await this.sleep(5000);
            }
        }
    }

    public stop() {
        this.isRunning = false;
        console.log("🛑 JobWorker stopping...");
    }

    private async poll() {
        // a. Fetch next job (using NFE_EMIT for now, could be dynamic)
        const { data, error } = await this.supabase.rpc('fetch_next_job', { p_job_type: 'NFE_EMIT' });

        if (error) {
            console.error("❌ Error fetching job:", error.message);
            await this.sleep(this.POLLING_INTERVAL_MS);
            return;
        }

        if (data && data.length > 0) {
            // Process the job
            await this.processJob(data[0]);
        } else {
            // Queue empty - wait before next poll
            // console.log("Empty queue, sleeping..."); // Verbose logging disabled
            await this.sleep(this.POLLING_INTERVAL_MS);
        }
    }

    private async processJob(job: Job): Promise<void> {
        try {
            console.log(`\n[JobWorker] Processando Job #${job.id} (Tipo: ${job.job_type})...`);

            switch (job.job_type) {
                case 'NFE_EMIT':
                    // 🛡️ Segurança: O payload contém dados sensíveis da nota!
                    // Não vamos logar o payload bruto aqui.
                    await this.processNfeEmit(job.payload);
                    break;

                default:
                    throw new Error(`Tipo de job desconhecido: ${job.job_type}`);
            }

            // Sucesso
            await this.supabase.from('jobs_queue').update({
                status: 'completed',
                updated_at: new Date().toISOString()
            }).eq('id', job.id);

            console.log(`[JobWorker] Job #${job.id} concluído com sucesso.`);

        } catch (error: any) {
            console.error(`[JobWorker] FALHA no Job #${job.id}:`);

            // 🛡️ CORREÇÃO DE SEGURANÇA
            console.error(`Erro: ${error.message}`);

            // Lógica de Retentativa (Backoff)
            const nextAttempt = job.attempts + 1;

            if (nextAttempt >= this.MAX_ATTEMPTS) {
                // Falha definitiva
                await this.supabase.from('jobs_queue').update({
                    status: 'failed',
                    last_error: error.message,
                    updated_at: new Date().toISOString()
                }).eq('id', job.id);

                console.log(`[JobWorker] Job #${job.id} atingiu limite de tentativas e falhou.`);
            } else {
                // Agendar retentativa (Exponential Backoff)
                const delaySeconds = Math.pow(2, nextAttempt) * 10; // 20s, 40s, 80s...
                const nextRun = new Date(Date.now() + delaySeconds * 1000);

                await this.supabase.from('jobs_queue').update({
                    status: 'pending', // Volta para pending para ser pego novamente
                    attempts: nextAttempt,
                    scheduled_for: nextRun.toISOString(),
                    last_error: error.message,
                    updated_at: new Date().toISOString()
                }).eq('id', job.id);

                console.log(`[JobWorker] Job #${job.id} reagendado para ${nextRun.toISOString()} (Tentativa ${nextAttempt})`);
            }
        }
    }

    // --- Processors ---

    private async processNfeEmit(payload: any) {
        // Stub implementation
        // In real scenario, this calls the SEFAZ service
        console.log(`   > Emitindo NFe (Simulação)...`);

        // Validate payload minimal
        if (!payload) throw new Error("Payload vazio invalidado.");

        // Simulate work
        await this.sleep(2000);

        // Simulate random failure for testing retries? (Optional)
        // if (Math.random() < 0.3) throw new Error("Erro de conexão simulado com a SEFAZ");
    }

    // --- Helpers ---

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Start the worker if run directly
const worker = new JobWorker();
worker.start();
