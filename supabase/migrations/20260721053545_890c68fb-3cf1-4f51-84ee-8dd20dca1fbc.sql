
-- Call Recording Compliance columns
ALTER TABLE public.ac_pbx_settings 
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_retention_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS dsgvo_announcement_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dsgvo_announcement_text text NOT NULL DEFAULT 'Dieses Gespräch wird zu Qualitäts- und Schulungszwecken aufgezeichnet. Bitte teilen Sie uns mit, wenn Sie damit nicht einverstanden sind.';

ALTER TABLE public.ac_contacts
  ADD COLUMN IF NOT EXISTS call_recording_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_recording_opt_out_at timestamptz;

ALTER TABLE public.ac_calls
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS dsgvo_announced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS recording_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ac_calls_customer ON public.ac_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_ac_calls_order ON public.ac_calls(order_id);
CREATE INDEX IF NOT EXISTS idx_ac_calls_retention ON public.ac_calls(recording_retention_until) WHERE recording_url IS NOT NULL AND recording_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ac_calls_started_at ON public.ac_calls(started_at DESC);
