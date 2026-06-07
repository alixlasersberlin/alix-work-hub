
-- ============================================================
-- AlixSmart Migration – Schema-Vorbereitung (idempotent)
-- ============================================================

-- Reusable updated_at trigger function already exists: public.set_updated_at()

-- ------------------------------------------------------------
-- 1) model_manuals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  model_name text,
  title text,
  file_url text,
  file_path text,
  file_type text,
  version text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_manuals TO authenticated;
GRANT ALL ON public.model_manuals TO service_role;
ALTER TABLE public.model_manuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_manuals_select" ON public.model_manuals;
CREATE POLICY "model_manuals_select" ON public.model_manuals FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Service') OR public.has_role('Technik')
    OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme')
    OR public.has_role('Serviceleitung') OR public.has_role('Finance')
    OR public.has_role('Marketing') OR public.has_role('Vertrieb')
    OR public.has_role('Order')
  );
DROP POLICY IF EXISTS "model_manuals_write" ON public.model_manuals;
CREATE POLICY "model_manuals_write" ON public.model_manuals FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Technik') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "model_manuals_update" ON public.model_manuals;
CREATE POLICY "model_manuals_update" ON public.model_manuals FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Technik') OR public.has_role('Serviceleitung'))
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Technik') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "model_manuals_delete" ON public.model_manuals;
CREATE POLICY "model_manuals_delete" ON public.model_manuals FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_model_manuals_updated_at ON public.model_manuals;
CREATE TRIGGER trg_model_manuals_updated_at BEFORE UPDATE ON public.model_manuals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 2) support_videos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  title text,
  description text,
  video_url text,
  thumbnail_url text,
  category text,
  device_model text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_videos TO authenticated;
GRANT ALL ON public.support_videos TO service_role;
ALTER TABLE public.support_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_videos_select" ON public.support_videos;
CREATE POLICY "support_videos_select" ON public.support_videos FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Service') OR public.has_role('Technik')
    OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme')
    OR public.has_role('Serviceleitung') OR public.has_role('Finance')
    OR public.has_role('Marketing') OR public.has_role('Vertrieb')
    OR public.has_role('Order')
  );
DROP POLICY IF EXISTS "support_videos_insert" ON public.support_videos;
CREATE POLICY "support_videos_insert" ON public.support_videos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Technik') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "support_videos_update" ON public.support_videos;
CREATE POLICY "support_videos_update" ON public.support_videos FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Technik') OR public.has_role('Serviceleitung'))
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Technik') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "support_videos_delete" ON public.support_videos;
CREATE POLICY "support_videos_delete" ON public.support_videos FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_support_videos_updated_at ON public.support_videos;
CREATE TRIGGER trg_support_videos_updated_at BEFORE UPDATE ON public.support_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3) customer_notes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  source_customer_id text,
  customer_email text,
  customer_name text,
  author_id uuid,
  note text,
  is_internal boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON public.customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_email ON public.customer_notes(customer_email);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_notes_select" ON public.customer_notes;
CREATE POLICY "customer_notes_select" ON public.customer_notes FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Service') OR public.has_role('Technik')
    OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme')
    OR public.has_role('Serviceleitung') OR public.has_role('Finance')
    OR public.has_role('Vertrieb') OR public.has_role('Order')
    OR public.has_role('Tourenplanung')
  );
DROP POLICY IF EXISTS "customer_notes_insert" ON public.customer_notes;
CREATE POLICY "customer_notes_insert" ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role('Kundenservice') OR public.has_role('Service')
    OR public.has_role('Technik') OR public.has_role('Vertrieb')
    OR public.has_role('Order') OR public.has_role('Reparaturannahme')
  );
DROP POLICY IF EXISTS "customer_notes_update" ON public.customer_notes;
CREATE POLICY "customer_notes_update" ON public.customer_notes FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Kundenservice') OR public.has_role('Service')
    OR public.has_role('Technik') OR public.has_role('Vertrieb')
    OR public.has_role('Order') OR public.has_role('Reparaturannahme')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('Kundenservice') OR public.has_role('Service')
    OR public.has_role('Technik') OR public.has_role('Vertrieb')
    OR public.has_role('Order') OR public.has_role('Reparaturannahme')
  );
DROP POLICY IF EXISTS "customer_notes_delete" ON public.customer_notes;
CREATE POLICY "customer_notes_delete" ON public.customer_notes FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_customer_notes_updated_at ON public.customer_notes;
CREATE TRIGGER trg_customer_notes_updated_at BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 4) maintenance_confirmations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  device_id uuid,
  source_device_id text,
  serial_number text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  confirmed_by uuid,
  confirmation_date timestamptz,
  signature_url text,
  document_url text,
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_confirmations_serial ON public.maintenance_confirmations(serial_number);
CREATE INDEX IF NOT EXISTS idx_maintenance_confirmations_customer ON public.maintenance_confirmations(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_confirmations TO authenticated;
GRANT ALL ON public.maintenance_confirmations TO service_role;
ALTER TABLE public.maintenance_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_confirmations_select" ON public.maintenance_confirmations;
CREATE POLICY "maintenance_confirmations_select" ON public.maintenance_confirmations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Service') OR public.has_role('Technik')
    OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme')
    OR public.has_role('Serviceleitung') OR public.has_role('Finance')
    OR public.has_role('Tourenplanung') OR public.has_role('Order')
  );
DROP POLICY IF EXISTS "maintenance_confirmations_insert" ON public.maintenance_confirmations;
CREATE POLICY "maintenance_confirmations_insert" ON public.maintenance_confirmations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "maintenance_confirmations_update" ON public.maintenance_confirmations;
CREATE POLICY "maintenance_confirmations_update" ON public.maintenance_confirmations FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Serviceleitung'))
  WITH CHECK (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "maintenance_confirmations_delete" ON public.maintenance_confirmations;
CREATE POLICY "maintenance_confirmations_delete" ON public.maintenance_confirmations FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_maintenance_confirmations_updated_at ON public.maintenance_confirmations;
CREATE TRIGGER trg_maintenance_confirmations_updated_at BEFORE UPDATE ON public.maintenance_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5) academy_sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  title text,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  location text,
  instructor text,
  max_participants integer,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_sessions TO authenticated;
GRANT ALL ON public.academy_sessions TO service_role;
ALTER TABLE public.academy_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academy_sessions_select" ON public.academy_sessions;
CREATE POLICY "academy_sessions_select" ON public.academy_sessions FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Marketing') OR public.has_role('Vertrieb')
    OR public.has_role('Service') OR public.has_role('Technik')
    OR public.has_role('Serviceleitung') OR public.has_role('Kundenservice')
    OR public.has_role('Order') OR public.has_role('Finance')
  );
DROP POLICY IF EXISTS "academy_sessions_insert" ON public.academy_sessions;
CREATE POLICY "academy_sessions_insert" ON public.academy_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "academy_sessions_update" ON public.academy_sessions;
CREATE POLICY "academy_sessions_update" ON public.academy_sessions FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Serviceleitung'))
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "academy_sessions_delete" ON public.academy_sessions;
CREATE POLICY "academy_sessions_delete" ON public.academy_sessions FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_academy_sessions_updated_at ON public.academy_sessions;
CREATE TRIGGER trg_academy_sessions_updated_at BEFORE UPDATE ON public.academy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 6) academy_bookings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  academy_session_id uuid REFERENCES public.academy_sessions(id) ON DELETE SET NULL,
  source_session_id text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  source_customer_id text,
  customer_name text,
  customer_email text,
  booking_status text NOT NULL DEFAULT 'booked',
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_academy_bookings_session ON public.academy_bookings(academy_session_id);
CREATE INDEX IF NOT EXISTS idx_academy_bookings_customer ON public.academy_bookings(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_bookings TO authenticated;
GRANT ALL ON public.academy_bookings TO service_role;
ALTER TABLE public.academy_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academy_bookings_select" ON public.academy_bookings;
CREATE POLICY "academy_bookings_select" ON public.academy_bookings FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Marketing') OR public.has_role('Vertrieb')
    OR public.has_role('Service') OR public.has_role('Technik')
    OR public.has_role('Serviceleitung') OR public.has_role('Kundenservice')
    OR public.has_role('Order') OR public.has_role('Finance')
  );
DROP POLICY IF EXISTS "academy_bookings_insert" ON public.academy_bookings;
CREATE POLICY "academy_bookings_insert" ON public.academy_bookings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Vertrieb') OR public.has_role('Kundenservice') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "academy_bookings_update" ON public.academy_bookings;
CREATE POLICY "academy_bookings_update" ON public.academy_bookings FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Vertrieb') OR public.has_role('Kundenservice') OR public.has_role('Serviceleitung'))
  WITH CHECK (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Vertrieb') OR public.has_role('Kundenservice') OR public.has_role('Serviceleitung'));
DROP POLICY IF EXISTS "academy_bookings_delete" ON public.academy_bookings;
CREATE POLICY "academy_bookings_delete" ON public.academy_bookings FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_academy_bookings_updated_at ON public.academy_bookings;
CREATE TRIGGER trg_academy_bookings_updated_at BEFORE UPDATE ON public.academy_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 7) email_unsubscribe_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  email text UNIQUE,
  token text,
  unsubscribed_at timestamptz,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_unsubscribe_tokens TO authenticated;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_unsubscribe_tokens_select" ON public.email_unsubscribe_tokens;
CREATE POLICY "email_unsubscribe_tokens_select" ON public.email_unsubscribe_tokens FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Finance'));
DROP POLICY IF EXISTS "email_unsubscribe_tokens_write" ON public.email_unsubscribe_tokens;
CREATE POLICY "email_unsubscribe_tokens_write" ON public.email_unsubscribe_tokens FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Marketing'));
DROP POLICY IF EXISTS "email_unsubscribe_tokens_update" ON public.email_unsubscribe_tokens;
CREATE POLICY "email_unsubscribe_tokens_update" ON public.email_unsubscribe_tokens FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing'))
  WITH CHECK (public.is_admin() OR public.has_role('Marketing'));
DROP POLICY IF EXISTS "email_unsubscribe_tokens_delete" ON public.email_unsubscribe_tokens;
CREATE POLICY "email_unsubscribe_tokens_delete" ON public.email_unsubscribe_tokens FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ------------------------------------------------------------
-- 8) suppressed_emails
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  email text UNIQUE,
  reason text,
  source_system text NOT NULL DEFAULT 'alixsmart',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppressed_emails TO authenticated;
GRANT ALL ON public.suppressed_emails TO service_role;
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppressed_emails_select" ON public.suppressed_emails;
CREATE POLICY "suppressed_emails_select" ON public.suppressed_emails FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing') OR public.has_role('Finance') OR public.has_role('Kundenservice'));
DROP POLICY IF EXISTS "suppressed_emails_insert" ON public.suppressed_emails;
CREATE POLICY "suppressed_emails_insert" ON public.suppressed_emails FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Marketing'));
DROP POLICY IF EXISTS "suppressed_emails_update" ON public.suppressed_emails;
CREATE POLICY "suppressed_emails_update" ON public.suppressed_emails FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing'))
  WITH CHECK (public.is_admin() OR public.has_role('Marketing'));
DROP POLICY IF EXISTS "suppressed_emails_delete" ON public.suppressed_emails;
CREATE POLICY "suppressed_emails_delete" ON public.suppressed_emails FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ------------------------------------------------------------
-- 9) Erweiterung lager_devices (additiv, nullable)
-- ------------------------------------------------------------
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS alixsmart_source_id text;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS source_system text;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS alixsmart_user_id text;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS device_status text;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS commissioning_date timestamptz;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS last_service_date timestamptz;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS next_service_date timestamptz;
ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS alixsmart_metadata jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lager_devices_alixsmart_source_id_key'
  ) THEN
    ALTER TABLE public.lager_devices
      ADD CONSTRAINT lager_devices_alixsmart_source_id_key UNIQUE (alixsmart_source_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 10) alixsmart_migration_map
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alixsmart_migration_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id text NOT NULL,
  target_table text NOT NULL,
  target_id uuid,
  match_key text,
  migration_status text NOT NULL DEFAULT 'pending',
  conflict_status text,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alixsmart_migration_map_src_unique UNIQUE (source_table, source_id)
);
CREATE INDEX IF NOT EXISTS idx_alixsmart_migration_map_status ON public.alixsmart_migration_map(migration_status);
CREATE INDEX IF NOT EXISTS idx_alixsmart_migration_map_target ON public.alixsmart_migration_map(target_table, target_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixsmart_migration_map TO authenticated;
GRANT ALL ON public.alixsmart_migration_map TO service_role;
ALTER TABLE public.alixsmart_migration_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alixsmart_migration_map_admin" ON public.alixsmart_migration_map;
CREATE POLICY "alixsmart_migration_map_admin" ON public.alixsmart_migration_map FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_alixsmart_migration_map_updated_at ON public.alixsmart_migration_map;
CREATE TRIGGER trg_alixsmart_migration_map_updated_at BEFORE UPDATE ON public.alixsmart_migration_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 11) alixsmart_migration_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alixsmart_migration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_batch_id text,
  source_table text,
  action text,
  status text,
  rows_processed integer NOT NULL DEFAULT 0,
  rows_success integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alixsmart_migration_logs_batch ON public.alixsmart_migration_logs(migration_batch_id);
CREATE INDEX IF NOT EXISTS idx_alixsmart_migration_logs_table ON public.alixsmart_migration_logs(source_table);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixsmart_migration_logs TO authenticated;
GRANT ALL ON public.alixsmart_migration_logs TO service_role;
ALTER TABLE public.alixsmart_migration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alixsmart_migration_logs_admin" ON public.alixsmart_migration_logs;
CREATE POLICY "alixsmart_migration_logs_admin" ON public.alixsmart_migration_logs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
