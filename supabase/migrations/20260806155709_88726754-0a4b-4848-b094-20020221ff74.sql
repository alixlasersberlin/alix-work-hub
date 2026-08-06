-- Schreibrecht-Helper
CREATE OR REPLACE FUNCTION public.plm_can_write()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT has_role('Super Admin') OR has_role('Admin') OR has_role('Geschäftsführung')
      OR has_role('Medical') OR has_role('Produktion') OR has_role('QM');
$$;

CREATE OR REPLACE FUNCTION public.plm_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ GERÄTE ============
CREATE TABLE public.plm_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number text NOT NULL,
  name text NOT NULL,
  product_family text,
  hardware_version text,
  software_version text,
  firmware_version text,
  ce_status text NOT NULL DEFAULT 'offen',
  mdr_status text NOT NULL DEFAULT 'offen',
  mdr_class text,
  udi_di text,
  serial_range_from text,
  serial_range_to text,
  production_start date,
  production_end date,
  version text NOT NULL DEFAULT '1.0',
  revision text NOT NULL DEFAULT 'A',
  responsible_user_id uuid,
  release_status text NOT NULL DEFAULT 'entwurf',
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_devices TO authenticated;
GRANT ALL ON public.plm_devices TO service_role;
ALTER TABLE public.plm_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_devices_sel ON public.plm_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_devices_ins ON public.plm_devices FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_devices_upd ON public.plm_devices FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_devices_del ON public.plm_devices FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_devices_upd BEFORE UPDATE ON public.plm_devices FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ BAUGRUPPEN ============
CREATE TABLE public.plm_assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.plm_assemblies(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  description text,
  version text NOT NULL DEFAULT '1.0',
  revision text NOT NULL DEFAULT 'A',
  release_status text NOT NULL DEFAULT 'entwurf',
  responsible_user_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  image_url text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plm_assemblies_device ON public.plm_assemblies(device_id);
CREATE INDEX idx_plm_assemblies_parent ON public.plm_assemblies(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_assemblies TO authenticated;
GRANT ALL ON public.plm_assemblies TO service_role;
ALTER TABLE public.plm_assemblies ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_assemblies_sel ON public.plm_assemblies FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_assemblies_ins ON public.plm_assemblies FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_assemblies_upd ON public.plm_assemblies FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_assemblies_del ON public.plm_assemblies FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_assemblies_upd BEFORE UPDATE ON public.plm_assemblies FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ LIEFERANTEN ============
CREATE TABLE public.plm_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_number text,
  name text NOT NULL,
  is_manufacturer boolean NOT NULL DEFAULT false,
  contact_name text,
  email text,
  phone text,
  website text,
  street text,
  zip text,
  city text,
  country text,
  iso_certificates text[],
  cert_valid_until date,
  audit_report_url text,
  quality_agreement boolean NOT NULL DEFAULT false,
  nda_signed boolean NOT NULL DEFAULT false,
  rating integer,
  release_status text NOT NULL DEFAULT 'offen',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_suppliers TO authenticated;
GRANT ALL ON public.plm_suppliers TO service_role;
ALTER TABLE public.plm_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_suppliers_sel ON public.plm_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_suppliers_ins ON public.plm_suppliers FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_suppliers_upd ON public.plm_suppliers FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_suppliers_del ON public.plm_suppliers FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_suppliers_upd BEFORE UPDATE ON public.plm_suppliers FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ EINZELTEILE ============
CREATE TABLE public.plm_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  manufacturer text,
  manufacturer_part_number text,
  primary_supplier_id uuid REFERENCES public.plm_suppliers(id) ON DELETE SET NULL,
  supplier_part_number text,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE SET NULL,
  version text NOT NULL DEFAULT '1.0',
  revision text NOT NULL DEFAULT 'A',
  release_status text NOT NULL DEFAULT 'entwurf',
  predecessor_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  successor_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  -- technische Daten
  dimensions text,
  weight_g numeric,
  material text,
  color text,
  surface text,
  voltage text,
  power_w numeric,
  current_a numeric,
  temperature_range text,
  protection_class text,
  ip_rating text,
  wavelength_nm text,
  optical_power text,
  tolerances text,
  -- Dokumente / Bilder
  photo_url text,
  cutout_image_url text,
  datasheet_url text,
  cad_url text,
  step_url text,
  drawing_pdf_url text,
  -- Einkauf
  price numeric,
  currency text NOT NULL DEFAULT 'EUR',
  stock_min numeric,
  stock_target numeric,
  stock_reorder numeric,
  lead_time_days integer,
  moq numeric,
  country_of_origin text,
  customs_code text,
  -- QM / MDR
  criticality text,
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  qs_responsible text,
  rohs boolean NOT NULL DEFAULT false,
  reach boolean NOT NULL DEFAULT false,
  gspr_reference text,
  risk_reference text,
  udi_reference text,
  is_spare_part boolean NOT NULL DEFAULT false,
  service_notes text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_plm_parts_number ON public.plm_parts(part_number);
CREATE INDEX idx_plm_parts_assembly ON public.plm_parts(assembly_id);
CREATE INDEX idx_plm_parts_device ON public.plm_parts(device_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_parts TO authenticated;
GRANT ALL ON public.plm_parts TO service_role;
ALTER TABLE public.plm_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_parts_sel ON public.plm_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_parts_ins ON public.plm_parts FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_parts_upd ON public.plm_parts FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_parts_del ON public.plm_parts FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_parts_upd BEFORE UPDATE ON public.plm_parts FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ LIEFERANT <-> BAUTEIL ============
CREATE TABLE public.plm_part_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.plm_parts(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.plm_suppliers(id) ON DELETE CASCADE,
  supplier_part_number text,
  price numeric,
  currency text NOT NULL DEFAULT 'EUR',
  moq numeric,
  lead_time_days integer,
  is_preferred boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_part_suppliers TO authenticated;
GRANT ALL ON public.plm_part_suppliers TO service_role;
ALTER TABLE public.plm_part_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_ps_sel ON public.plm_part_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_ps_ins ON public.plm_part_suppliers FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ps_upd ON public.plm_part_suppliers FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ps_del ON public.plm_part_suppliers FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_ps_upd BEFORE UPDATE ON public.plm_part_suppliers FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ STÜCKLISTE ============
CREATE TABLE public.plm_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE CASCADE,
  child_assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE CASCADE,
  position_no integer,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Stk',
  install_position text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plm_bom_device ON public.plm_bom_items(device_id);
CREATE INDEX idx_plm_bom_assembly ON public.plm_bom_items(assembly_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_bom_items TO authenticated;
GRANT ALL ON public.plm_bom_items TO service_role;
ALTER TABLE public.plm_bom_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_bom_sel ON public.plm_bom_items FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_bom_ins ON public.plm_bom_items FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_bom_upd ON public.plm_bom_items FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_bom_del ON public.plm_bom_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_bom_upd BEFORE UPDATE ON public.plm_bom_items FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ DOKUMENTE ============
CREATE TABLE public.plm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  doc_type text NOT NULL,
  title text NOT NULL,
  document_number text,
  version text NOT NULL DEFAULT '1.0',
  revision text NOT NULL DEFAULT 'A',
  file_path text,
  file_url text,
  mime_type text,
  file_size bigint,
  valid_until date,
  release_status text NOT NULL DEFAULT 'entwurf',
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plm_documents_entity ON public.plm_documents(entity_type, entity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_documents TO authenticated;
GRANT ALL ON public.plm_documents TO service_role;
ALTER TABLE public.plm_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_docs_sel ON public.plm_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_docs_ins ON public.plm_documents FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_docs_upd ON public.plm_documents FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_docs_del ON public.plm_documents FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_docs_upd BEFORE UPDATE ON public.plm_documents FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ EXPLOSIONSZEICHNUNGEN ============
CREATE TABLE public.plm_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE CASCADE,
  document_number text,
  title text NOT NULL,
  drawing_type text NOT NULL DEFAULT 'explosion',
  view_type text NOT NULL DEFAULT 'gesamt',
  image_url text,
  version text NOT NULL DEFAULT '1.0',
  revision text NOT NULL DEFAULT 'A',
  status text NOT NULL DEFAULT 'entwurf',
  created_by_name text,
  checked_by_name text,
  approved_by_name text,
  approved_at timestamptz,
  released_at date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plm_drawings_device ON public.plm_drawings(device_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_drawings TO authenticated;
GRANT ALL ON public.plm_drawings TO service_role;
ALTER TABLE public.plm_drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_dr_sel ON public.plm_drawings FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_dr_ins ON public.plm_drawings FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_dr_upd ON public.plm_drawings FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_dr_del ON public.plm_drawings FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_dr_upd BEFORE UPDATE ON public.plm_drawings FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

CREATE TABLE public.plm_drawing_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES public.plm_drawings(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE SET NULL,
  position_no integer NOT NULL,
  label text,
  quantity numeric NOT NULL DEFAULT 1,
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plm_drawing_pos ON public.plm_drawing_positions(drawing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_drawing_positions TO authenticated;
GRANT ALL ON public.plm_drawing_positions TO service_role;
ALTER TABLE public.plm_drawing_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_drp_sel ON public.plm_drawing_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_drp_ins ON public.plm_drawing_positions FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_drp_upd ON public.plm_drawing_positions FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_drp_del ON public.plm_drawing_positions FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_drp_upd BEFORE UPDATE ON public.plm_drawing_positions FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ ÄNDERUNGSMANAGEMENT ============
CREATE TABLE public.plm_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_number text,
  change_kind text NOT NULL DEFAULT 'ECR',
  title text NOT NULL,
  description text,
  reason text,
  risk_assessment text,
  risk_level text,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE SET NULL,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE SET NULL,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  old_revision text,
  new_revision text,
  status text NOT NULL DEFAULT 'beantragt',
  requested_by uuid DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  qm_approved_by uuid,
  qm_approved_at timestamptz,
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_changes TO authenticated;
GRANT ALL ON public.plm_changes TO service_role;
ALTER TABLE public.plm_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_ch_sel ON public.plm_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_ch_ins ON public.plm_changes FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ch_upd ON public.plm_changes FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ch_del ON public.plm_changes FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_ch_upd BEFORE UPDATE ON public.plm_changes FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ PRÜFPLÄNE ============
CREATE TABLE public.plm_inspection_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_number text,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'wareneingang',
  version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'entwurf',
  qs_responsible text,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_inspection_plans TO authenticated;
GRANT ALL ON public.plm_inspection_plans TO service_role;
ALTER TABLE public.plm_inspection_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_ip_sel ON public.plm_inspection_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_ip_ins ON public.plm_inspection_plans FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ip_upd ON public.plm_inspection_plans FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ip_del ON public.plm_inspection_plans FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_ip_upd BEFORE UPDATE ON public.plm_inspection_plans FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

CREATE TABLE public.plm_inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plm_inspection_plans(id) ON DELETE CASCADE,
  position_no integer,
  characteristic text NOT NULL,
  method text,
  gauge text,
  nominal text,
  tolerance_min numeric,
  tolerance_max numeric,
  unit text,
  is_critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_inspection_items TO authenticated;
GRANT ALL ON public.plm_inspection_items TO service_role;
ALTER TABLE public.plm_inspection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_ii_sel ON public.plm_inspection_items FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_ii_ins ON public.plm_inspection_items FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ii_upd ON public.plm_inspection_items FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_ii_del ON public.plm_inspection_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_ii_upd BEFORE UPDATE ON public.plm_inspection_items FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ WARENEINGANG ============
CREATE TABLE public.plm_goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text,
  part_id uuid REFERENCES public.plm_parts(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.plm_suppliers(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Stk',
  batch_number text,
  lot_number text,
  serial_numbers text[],
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  inspection_plan_id uuid REFERENCES public.plm_inspection_plans(id) ON DELETE SET NULL,
  inspection_result text NOT NULL DEFAULT 'offen',
  inspected_by uuid,
  inspected_at timestamptz,
  deviation text,
  blocked boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_goods_receipts TO authenticated;
GRANT ALL ON public.plm_goods_receipts TO service_role;
ALTER TABLE public.plm_goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_gr_sel ON public.plm_goods_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_gr_ins ON public.plm_goods_receipts FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_gr_upd ON public.plm_goods_receipts FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_gr_del ON public.plm_goods_receipts FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_gr_upd BEFORE UPDATE ON public.plm_goods_receipts FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ PRODUKTIONSAUFTRÄGE ============
CREATE TABLE public.plm_production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'geplant',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  batch_number text,
  serial_numbers text[],
  responsible_user_id uuid,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_production_orders TO authenticated;
GRANT ALL ON public.plm_production_orders TO service_role;
ALTER TABLE public.plm_production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_po_sel ON public.plm_production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_po_ins ON public.plm_production_orders FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_po_upd ON public.plm_production_orders FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_po_del ON public.plm_production_orders FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_po_upd BEFORE UPDATE ON public.plm_production_orders FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ ARBEITSANWEISUNGEN ============
CREATE TABLE public.plm_work_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_number text,
  title text NOT NULL,
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE SET NULL,
  assembly_id uuid REFERENCES public.plm_assemblies(id) ON DELETE SET NULL,
  content text,
  file_url text,
  version text NOT NULL DEFAULT '1.0',
  revision text NOT NULL DEFAULT 'A',
  status text NOT NULL DEFAULT 'entwurf',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_work_instructions TO authenticated;
GRANT ALL ON public.plm_work_instructions TO service_role;
ALTER TABLE public.plm_work_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_wi_sel ON public.plm_work_instructions FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_wi_ins ON public.plm_work_instructions FOR INSERT TO authenticated WITH CHECK (public.plm_can_write());
CREATE POLICY plm_wi_upd ON public.plm_work_instructions FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write());
CREATE POLICY plm_wi_del ON public.plm_work_instructions FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_plm_wi_upd BEFORE UPDATE ON public.plm_work_instructions FOR EACH ROW EXECUTE FUNCTION public.plm_touch_updated_at();

-- ============ AUDIT TRAIL ============
CREATE TABLE public.plm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  changes jsonb,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plm_audit_entity ON public.plm_audit_log(entity_type, entity_id);
GRANT SELECT, INSERT ON public.plm_audit_log TO authenticated;
GRANT ALL ON public.plm_audit_log TO service_role;
ALTER TABLE public.plm_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_al_sel ON public.plm_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_al_ins ON public.plm_audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());