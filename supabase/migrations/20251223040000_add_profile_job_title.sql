-- Add job_title to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS job_title text;
