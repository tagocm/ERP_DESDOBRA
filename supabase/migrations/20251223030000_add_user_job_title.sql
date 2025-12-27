-- Add job_title to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title text;
