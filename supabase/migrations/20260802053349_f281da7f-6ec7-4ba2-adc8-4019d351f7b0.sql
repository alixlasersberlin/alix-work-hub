ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_surveys_public_token ON public.surveys(public_token) WHERE public_token IS NOT NULL;