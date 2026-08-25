CREATE TABLE public.mfa_sms_factors (
  user_id UUID PRIMARY KEY,
  phone TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_sms_factors TO authenticated;
GRANT ALL ON public.mfa_sms_factors TO service_role;

ALTER TABLE public.mfa_sms_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sms factor"
ON public.mfa_sms_factors FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_mfa_sms_factors_updated_at
BEFORE UPDATE ON public.mfa_sms_factors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mfa_sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.mfa_sms_codes TO service_role;

ALTER TABLE public.mfa_sms_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mfa_sms_codes_user ON public.mfa_sms_codes (user_id, created_at DESC);