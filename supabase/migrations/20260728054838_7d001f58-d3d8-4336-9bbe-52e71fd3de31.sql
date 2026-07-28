ALTER TABLE public.social_clients
  ADD COLUMN IF NOT EXISTS onboarding_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS onboarding_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_clients_onboarding_token ON public.social_clients(onboarding_token);