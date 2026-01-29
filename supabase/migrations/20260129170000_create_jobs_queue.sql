-- Tabela de Fila (Design by Agent B)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.jobs_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status public.job_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheduled_for TIMESTAMPTZ DEFAULT now()
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON public.jobs_queue (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_history ON public.jobs_queue (job_type, created_at DESC);

-- Segurança (RLS)
ALTER TABLE public.jobs_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service Role full access" ON public.jobs_queue;
CREATE POLICY "Service Role full access" ON public.jobs_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- FUNÇÃO CRÍTICA: Pega o próximo job atomicamente (Evita Concorrência)
CREATE OR REPLACE FUNCTION public.fetch_next_job(p_job_type text)
RETURNS SETOF public.jobs_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.jobs_queue
  SET status = 'processing',
      updated_at = now(),
      attempts = attempts + 1
  WHERE id = (
    SELECT id
    FROM public.jobs_queue
    WHERE status = 'pending'
      AND job_type = p_job_type
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED -- O Segredo: Pula linhas travadas por outros workers
  )
  RETURNING *;
END;
$$;
