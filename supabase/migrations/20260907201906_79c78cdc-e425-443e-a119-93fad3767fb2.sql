CREATE TABLE public.ph_lang_sync_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL UNIQUE CHECK (locale IN ('de','en','es','ru','ar')),
  site_code text NOT NULL,
  site_label text NOT NULL,
  base_url text NOT NULL,
  path_prefix text NOT NULL DEFAULT '',
  target_system text NOT NULL DEFAULT 'unknown',
  write_endpoint text,
  write_secret_name text,
  publish_enabled boolean NOT NULL DEFAULT false,
  structure_status text NOT NULL DEFAULT 'unknown' CHECK (structure_status IN ('unknown','missing','read_only','ready')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ph_lang_sync_targets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ph_lang_sync_targets TO authenticated;
GRANT ALL ON public.ph_lang_sync_targets TO service_role;
ALTER TABLE public.ph_lang_sync_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY ph_lst_read ON public.ph_lang_sync_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_lst_insert ON public.ph_lang_sync_targets FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lst_update ON public.ph_lang_sync_targets FOR UPDATE TO authenticated USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lst_delete ON public.ph_lang_sync_targets FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.ph_lang_sync_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  site_code text NOT NULL,
  remote_product_id text NOT NULL,
  remote_url text,
  verified_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, site_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_lang_sync_map TO authenticated;
GRANT ALL ON public.ph_lang_sync_map TO service_role;
ALTER TABLE public.ph_lang_sync_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY ph_lsm_read ON public.ph_lang_sync_map FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_lsm_insert ON public.ph_lang_sync_map FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lsm_update ON public.ph_lang_sync_map FOR UPDATE TO authenticated USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lsm_delete ON public.ph_lang_sync_map FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.ph_lang_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  locale text NOT NULL,
  site_code text NOT NULL,
  site_label text,
  target_url text,
  remote_product_id text,
  mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run','publish','rollback')),
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','ok','blocked','failed','rolled_back')),
  translation_status text,
  fallback_detected boolean NOT NULL DEFAULT false,
  publish_allowed boolean NOT NULL DEFAULT false,
  fields_checked int NOT NULL DEFAULT 0,
  fields_changed int NOT NULL DEFAULT 0,
  fields_unchanged int NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  rolled_back_run_id uuid REFERENCES public.ph_lang_sync_runs(id) ON DELETE SET NULL,
  rolled_back_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_lang_sync_runs TO authenticated;
GRANT ALL ON public.ph_lang_sync_runs TO service_role;
ALTER TABLE public.ph_lang_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ph_lsr_read ON public.ph_lang_sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_lsr_insert ON public.ph_lang_sync_runs FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lsr_update ON public.ph_lang_sync_runs FOR UPDATE TO authenticated USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lsr_delete ON public.ph_lang_sync_runs FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_ph_lsr_product ON public.ph_lang_sync_runs (product_id, locale, created_at DESC);

CREATE TABLE public.ph_lang_sync_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ph_lang_sync_runs(id) ON DELETE CASCADE,
  field text NOT NULL,
  remote_field text,
  value_before text,
  value_after text,
  action text NOT NULL DEFAULT 'unchanged' CHECK (action IN ('change','unchanged','blocked','failed','restored')),
  write_status text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_lang_sync_fields TO authenticated;
GRANT ALL ON public.ph_lang_sync_fields TO service_role;
ALTER TABLE public.ph_lang_sync_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY ph_lsf_read ON public.ph_lang_sync_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY ph_lsf_insert ON public.ph_lang_sync_fields FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lsf_update ON public.ph_lang_sync_fields FOR UPDATE TO authenticated USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit());
CREATE POLICY ph_lsf_delete ON public.ph_lang_sync_fields FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_ph_lsf_run ON public.ph_lang_sync_fields (run_id);

INSERT INTO public.ph_lang_sync_targets (locale, site_code, site_label, base_url, path_prefix, target_system, write_endpoint, write_secret_name, publish_enabled, structure_status, note) VALUES
 ('de','de','alix-lasers.de','https://alix-lasers.de','', 'unknown', NULL, NULL, false, 'unknown', 'Master-Sprache; Sprach-Sync nicht erforderlich'),
 ('en','com','alix-lasers.com','https://www.alix-lasers.com','', 'com_devices', 'https://www.alix-lasers.com/api/public/product-hub/update', 'COM_PRODUCT_HUB_WRITE_KEY', false, 'unknown', 'Schreibweg wie Canary; Sprachfelder noch zu prüfen'),
 ('es','com_es','alix-lasers.com/es','https://www.alix-lasers.com','/es','com_devices', 'https://www.alix-lasers.com/api/public/product-hub/update', 'COM_PRODUCT_HUB_WRITE_KEY', false, 'unknown', NULL),
 ('ru','com_ru','alix-lasers.com/ru','https://www.alix-lasers.com','/ru','com_devices', 'https://www.alix-lasers.com/api/public/product-hub/update', 'COM_PRODUCT_HUB_WRITE_KEY', false, 'unknown', NULL),
 ('ar','ae','alix-lasers.ae','https://alix-lasers.ae','','unknown', NULL, NULL, false, 'unknown', 'UAE-Struktur derzeit en-AE; arabische Zielstruktur zu prüfen');

INSERT INTO public.ph_lang_sync_map (product_id, site_code, remote_product_id, remote_url, note)
SELECT p.id, 'com', 'c9f9b7c9-d6b7-4ed6-ac60-913cbdec2dd6', 'https://www.alix-lasers.com/produkte/alix-blueice-smart-ki', 'Pilot-Zuordnung wie Canary (strikt per ID)'
FROM public.ph_products p WHERE p.id = 'dcb978ce-6b71-45c6-8da8-3ede23111b99';