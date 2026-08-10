
CREATE TABLE public.plm_manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_code text,
  name text NOT NULL,
  short_name text,
  name_normalized text,
  logo_url text,
  country text,
  street text,
  zip text,
  city text,
  phone text,
  email text,
  website text,
  contact_name text,
  contact_position text,
  notes text,
  iso_9001 boolean NOT NULL DEFAULT false,
  iso_13485 boolean NOT NULL DEFAULT false,
  iso_22716 boolean NOT NULL DEFAULT false,
  iso_14001 boolean NOT NULL DEFAULT false,
  iso_45001 boolean NOT NULL DEFAULT false,
  rohs boolean NOT NULL DEFAULT false,
  reach boolean NOT NULL DEFAULT false,
  ce boolean NOT NULL DEFAULT false,
  fda boolean NOT NULL DEFAULT false,
  ul boolean NOT NULL DEFAULT false,
  iec boolean NOT NULL DEFAULT false,
  cb_report boolean NOT NULL DEFAULT false,
  cert_valid_until date,
  audit_status text DEFAULT 'offen',
  audit_date date,
  next_audit_date date,
  approval_status text NOT NULL DEFAULT 'bedingt_freigegeben',
  is_critical boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plm_manufacturers_norm_uidx ON public.plm_manufacturers (name_normalized) WHERE name_normalized IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_manufacturers TO authenticated;
GRANT ALL ON public.plm_manufacturers TO service_role;
ALTER TABLE public.plm_manufacturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_manufacturers_sel ON public.plm_manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_manufacturers_ins ON public.plm_manufacturers FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_manufacturers_upd ON public.plm_manufacturers FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_manufacturers_del ON public.plm_manufacturers FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE TABLE public.plm_manufacturer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES public.plm_manufacturers(id) ON DELETE CASCADE,
  doc_type text,
  title text NOT NULL,
  document_number text,
  version text,
  revision text,
  valid_until date,
  release_status text DEFAULT 'entwurf',
  responsible text,
  file_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_manufacturer_documents TO authenticated;
GRANT ALL ON public.plm_manufacturer_documents TO service_role;
ALTER TABLE public.plm_manufacturer_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_mfr_docs_sel ON public.plm_manufacturer_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_mfr_docs_ins ON public.plm_manufacturer_documents FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_mfr_docs_upd ON public.plm_manufacturer_documents FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_mfr_docs_del ON public.plm_manufacturer_documents FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE TABLE public.plm_manufacturer_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES public.plm_manufacturers(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.plm_suppliers(id) ON DELETE CASCADE,
  lead_time_days integer,
  moq numeric,
  price numeric,
  currency text DEFAULT 'EUR',
  incoterms text,
  rating numeric,
  response_time_hours integer,
  is_preferred boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_manufacturer_suppliers TO authenticated;
GRANT ALL ON public.plm_manufacturer_suppliers TO service_role;
ALTER TABLE public.plm_manufacturer_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_mfr_sup_sel ON public.plm_manufacturer_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_mfr_sup_ins ON public.plm_manufacturer_suppliers FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_mfr_sup_upd ON public.plm_manufacturer_suppliers FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_mfr_sup_del ON public.plm_manufacturer_suppliers FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE TABLE public.plm_manufacturer_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.plm_manufacturers(id) ON DELETE SET NULL,
  source_name text,
  source_id uuid,
  action text NOT NULL DEFAULT 'merged',
  parts_moved integer DEFAULT 0,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_manufacturer_merges TO authenticated;
GRANT ALL ON public.plm_manufacturer_merges TO service_role;
ALTER TABLE public.plm_manufacturer_merges ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_mfr_merges_sel ON public.plm_manufacturer_merges FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_mfr_merges_ins ON public.plm_manufacturer_merges FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_mfr_merges_del ON public.plm_manufacturer_merges FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

ALTER TABLE public.plm_parts
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.plm_manufacturers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_part_number text,
  ADD COLUMN IF NOT EXISTS successor_part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS predecessor_part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS plm_parts_manufacturer_idx ON public.plm_parts (manufacturer_id);

CREATE OR REPLACE FUNCTION public.plm_normalize_manufacturer(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
    lower(coalesce(p,'')),
    '(gmbh|ltd|limited|inc|co|corp|corporation|enterprises|technology|technologies|electronics|international|taiwan|china|germany|europe|\s|\.|,|-|&|/)',
    '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.plm_manufacturers_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.name_normalized := nullif(public.plm_normalize_manufacturer(NEW.name), '');
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER plm_manufacturers_touch_trg BEFORE INSERT OR UPDATE ON public.plm_manufacturers
FOR EACH ROW EXECUTE FUNCTION public.plm_manufacturers_touch();

CREATE OR REPLACE FUNCTION public.plm_merge_manufacturers(p_target uuid, p_source uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE moved integer := 0;
BEGIN
  IF NOT plm_can_write() THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF p_target = p_source THEN RETURN 0; END IF;
  UPDATE plm_parts SET manufacturer_id = p_target WHERE manufacturer_id = p_source;
  GET DIAGNOSTICS moved = ROW_COUNT;
  UPDATE plm_manufacturer_documents SET manufacturer_id = p_target WHERE manufacturer_id = p_source;
  UPDATE plm_manufacturer_suppliers ms SET manufacturer_id = p_target
    WHERE manufacturer_id = p_source
      AND NOT EXISTS (SELECT 1 FROM plm_manufacturer_suppliers x WHERE x.manufacturer_id = p_target AND x.supplier_id = ms.supplier_id);
  DELETE FROM plm_manufacturer_suppliers WHERE manufacturer_id = p_source;
  INSERT INTO plm_manufacturer_merges (target_id, source_id, source_name, action, parts_moved, performed_by)
    SELECT p_target, p_source, name, 'merged', moved, auth.uid() FROM plm_manufacturers WHERE id = p_source;
  DELETE FROM plm_manufacturers WHERE id = p_source;
  RETURN moved;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_merge_manufacturers(uuid, uuid) TO authenticated;
