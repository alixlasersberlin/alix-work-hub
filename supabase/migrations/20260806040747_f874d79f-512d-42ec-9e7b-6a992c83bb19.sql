
-- ============ ENUMS ============
CREATE TYPE public.delivery_status AS ENUM (
  'entwurf','intern_geplant','kundenanfrage_vorbereitet','bestaetigung_versendet','kunde_geoeffnet',
  'kunde_bestaetigt','kunde_abgelehnt','kunde_alternativtermin','intern_bestaetigt','fahrer_zugeteilt',
  'fahrzeug_zugeteilt','tour_freigegeben','unterwegs','angekommen','lieferung_begonnen',
  'erfolgreich_ausgeliefert','teilweise_ausgeliefert','nicht_angetroffen','lieferung_fehlgeschlagen',
  'verschoben','storniert','abgeschlossen'
);

CREATE TYPE public.delivery_appointment_type AS ENUM (
  'auslieferung','auslieferung_installation','auslieferung_einweisung','auslieferung_schulung',
  'abholung','geraetetausch','ersatzgeraet','rueckholung','wartung','reparaturabholung',
  'servicetermin','messe_lieferung','interne_transportfahrt'
);

CREATE TYPE public.delivery_readiness AS ENUM ('gruen','gelb','rot');
CREATE TYPE public.delivery_vehicle_status AS ENUM ('verfuegbar','reserviert','unterwegs','in_wartung','defekt','gesperrt');
CREATE TYPE public.delivery_loading_status AS ENUM ('nicht_vorbereitet','vorbereitet','kontrolliert','geladen','fehlt','beschaedigt');
CREATE TYPE public.delivery_tour_status AS ENUM ('entwurf','geplant','geprueft','freigegeben','aktiv','abgeschlossen','archiviert','storniert');

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.can_plan_delivery()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin')
      OR public.has_role('Tourenplanung') OR public.has_role('Order')
      OR public.has_role('Auftragsverwaltung') OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_view_delivery()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_plan_delivery()
      OR public.has_role('Finance') OR public.has_role('Vertrieb')
      OR public.has_role('Vertriebsleitung') OR public.has_role('Technik')
      OR public.has_role('Service') OR public.has_role('Serviceleitung')
      OR public.has_role('Kundenservice') OR public.has_role('Geschäftsführung')
      OR public.has_role('Read Only Audit') OR public.has_role('Read Only');
$$;

CREATE OR REPLACE FUNCTION public.can_release_delivery_tour()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Tourenplanung');
$$;

-- ============ STAMMDATEN: STANDORTE ============
CREATE TABLE public.delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'lager',
  street text, zip text, city text, country text DEFAULT 'DE',
  lat numeric, lng numeric,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_locations TO authenticated;
GRANT ALL ON public.delivery_locations TO service_role;
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dl_select ON public.delivery_locations FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dl_insert ON public.delivery_locations FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dl_update ON public.delivery_locations FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dl_delete ON public.delivery_locations FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ FAHRZEUGE ============
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate text NOT NULL,
  name text,
  vehicle_type text,
  manufacturer text,
  model text,
  load_volume_m3 numeric,
  max_payload_kg numeric,
  has_trailer_hitch boolean NOT NULL DEFAULT false,
  special_equipment text,
  status public.delivery_vehicle_status NOT NULL DEFAULT 'verfuegbar',
  odometer_km numeric,
  fuel_level_pct numeric,
  is_electric boolean NOT NULL DEFAULT false,
  range_km numeric,
  hu_due_date date,
  insurance_until date,
  next_service_date date,
  tire_status text,
  location_id uuid REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY veh_select ON public.vehicles FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY veh_insert ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY veh_update ON public.vehicles FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY veh_delete ON public.vehicles FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.vehicle_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  is_blocking boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_availability TO authenticated;
GRANT ALL ON public.vehicle_availability TO service_role;
ALTER TABLE public.vehicle_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY va_select ON public.vehicle_availability FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY va_insert ON public.vehicle_availability FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY va_update ON public.vehicle_availability FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY va_delete ON public.vehicle_availability FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  due_date date,
  performed_at date,
  odometer_km numeric,
  cost numeric,
  workshop text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance TO authenticated;
GRANT ALL ON public.vehicle_maintenance TO service_role;
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY vm_select ON public.vehicle_maintenance FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY vm_insert ON public.vehicle_maintenance FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY vm_update ON public.vehicle_maintenance FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY vm_delete ON public.vehicle_maintenance FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ FAHRER ============
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  department text,
  phone text,
  mobile text,
  email text,
  license_classes text[],
  license_valid_until date,
  license_status text,
  languages text[],
  country_clearances text[],
  max_daily_work_minutes integer NOT NULL DEFAULT 480,
  work_start time,
  work_end time,
  home_location_id uuid REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  can_train boolean NOT NULL DEFAULT false,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY drv_select ON public.drivers FOR SELECT TO authenticated USING (public.can_view_delivery() OR user_id = auth.uid());
CREATE POLICY drv_insert ON public.drivers FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY drv_update ON public.drivers FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY drv_delete ON public.drivers FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.driver_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  qualification text NOT NULL,
  valid_until date,
  document_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_qualifications TO authenticated;
GRANT ALL ON public.driver_qualifications TO service_role;
ALTER TABLE public.driver_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY dq_select ON public.driver_qualifications FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dq_insert ON public.driver_qualifications FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dq_update ON public.driver_qualifications FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dq_delete ON public.driver_qualifications FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'abwesend',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_availability TO authenticated;
GRANT ALL ON public.driver_availability TO service_role;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY dav_select ON public.driver_availability FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dav_insert ON public.driver_availability FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dav_update ON public.driver_availability FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dav_delete ON public.driver_availability FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ TOUREN ============
CREATE SEQUENCE IF NOT EXISTS public.delivery_tour_number_seq START 1000;

CREATE TABLE public.delivery_tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_number text NOT NULL UNIQUE DEFAULT ('T-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.delivery_tour_number_seq')::text, 5, '0')),
  tour_date date NOT NULL,
  title text,
  status public.delivery_tour_status NOT NULL DEFAULT 'entwurf',
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  codriver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  start_location_id uuid REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  end_location_id uuid REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  custom_start_address text,
  planned_start_time time,
  planned_end_time time,
  planned_distance_km numeric,
  planned_drive_minutes integer,
  planned_work_minutes integer,
  planned_break_minutes integer NOT NULL DEFAULT 0,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  actual_distance_km numeric,
  utilization_pct numeric,
  released_by uuid,
  released_at timestamptz,
  region text,
  country text,
  notes text,
  internal_notes text,
  archived_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tours TO authenticated;
GRANT ALL ON public.delivery_tours TO service_role;
ALTER TABLE public.delivery_tours ENABLE ROW LEVEL SECURITY;
CREATE POLICY dt_select ON public.delivery_tours FOR SELECT TO authenticated USING (
  public.can_view_delivery()
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR codriver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY dt_insert ON public.delivery_tours FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dt_update ON public.delivery_tours FOR UPDATE TO authenticated USING (
  public.can_plan_delivery()
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY dt_delete ON public.delivery_tours FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_delivery_tours_date ON public.delivery_tours(tour_date DESC);
CREATE INDEX idx_delivery_tours_driver ON public.delivery_tours(driver_id);
CREATE INDEX idx_delivery_tours_status ON public.delivery_tours(status);

-- ============ LIEFERTERMINE ============
CREATE TABLE public.delivery_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  customer_id uuid,
  route_plan_id uuid,
  esc_event_id uuid,
  appointment_type public.delivery_appointment_type NOT NULL DEFAULT 'auslieferung',
  status public.delivery_status NOT NULL DEFAULT 'entwurf',
  readiness public.delivery_readiness NOT NULL DEFAULT 'gelb',
  readiness_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_override_by uuid,
  readiness_override_reason text,
  readiness_override_at timestamptz,
  -- Kundendaten (Snapshot)
  order_number text,
  quote_number text,
  invoice_number text,
  customer_number text,
  customer_name text,
  company_name text,
  contact_name text,
  contact_phone text,
  contact_mobile text,
  contact_email text,
  delivery_street text, delivery_zip text, delivery_city text, delivery_country text DEFAULT 'DE',
  delivery_lat numeric, delivery_lng numeric,
  billing_address text,
  -- Gerät
  device_name text, device_model text, article_name text, serial_number text,
  accessories text, scope_of_delivery text,
  -- Finanzen
  payment_status text, open_amount numeric, financing_type text,
  -- Planung
  requested_date date,
  promised_window text,
  planned_date date,
  planned_arrival time,
  time_window_start time,
  time_window_end time,
  duration_minutes integer NOT NULL DEFAULT 60,
  salesperson_name text,
  responsible_user_id uuid,
  requires_training boolean NOT NULL DEFAULT false,
  requires_nisv_docs boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'normal',
  is_vip boolean NOT NULL DEFAULT false,
  internal_notes text,
  customer_notes text,
  document_ids uuid[],
  confirmed_at timestamptz,
  confirmed_channel text,
  delivered_at timestamptz,
  failure_reason text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_appointments TO authenticated;
GRANT ALL ON public.delivery_appointments TO service_role;
ALTER TABLE public.delivery_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY da_insert ON public.delivery_appointments FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY da_update ON public.delivery_appointments FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY da_delete ON public.delivery_appointments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_da_order ON public.delivery_appointments(order_id);
CREATE INDEX idx_da_customer ON public.delivery_appointments(customer_id);
CREATE INDEX idx_da_planned_date ON public.delivery_appointments(planned_date DESC);
CREATE INDEX idx_da_status ON public.delivery_appointments(status);

-- ============ TOUR STOPS ============
CREATE TABLE public.delivery_tour_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  distance_from_prev_km numeric,
  drive_minutes_from_prev integer,
  planned_arrival timestamptz,
  planned_departure timestamptz,
  actual_arrival timestamptz,
  actual_departure timestamptz,
  stop_status public.delivery_status,
  delay_minutes integer,
  delay_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tour_stops TO authenticated;
GRANT ALL ON public.delivery_tour_stops TO service_role;
ALTER TABLE public.delivery_tour_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY dts_select ON public.delivery_tour_stops FOR SELECT TO authenticated USING (
  public.can_view_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_tours t WHERE t.id = tour_id
             AND (t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
               OR t.codriver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())))
);
CREATE POLICY dts_insert ON public.delivery_tour_stops FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dts_update ON public.delivery_tour_stops FOR UPDATE TO authenticated USING (
  public.can_plan_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_tours t WHERE t.id = tour_id
             AND t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
CREATE POLICY dts_delete ON public.delivery_tour_stops FOR DELETE TO authenticated USING (public.has_role('Super Admin') OR public.can_plan_delivery());
CREATE INDEX idx_dts_tour ON public.delivery_tour_stops(tour_id, position);
CREATE INDEX idx_dts_appointment ON public.delivery_tour_stops(appointment_id);

CREATE POLICY da_select ON public.delivery_appointments FOR SELECT TO authenticated USING (
  public.can_view_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_tour_stops s JOIN public.delivery_tours t ON t.id = s.tour_id
             WHERE s.appointment_id = delivery_appointments.id
               AND (t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
                 OR t.codriver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())))
);

-- ============ STATUS HISTORY ============
CREATE TABLE public.delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid DEFAULT auth.uid(),
  changed_by_name text,
  source text NOT NULL DEFAULT 'app',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_status_history TO authenticated;
GRANT ALL ON public.delivery_status_history TO service_role;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY dsh_select ON public.delivery_status_history FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dsh_insert ON public.delivery_status_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_dsh_appointment ON public.delivery_status_history(appointment_id, created_at DESC);

-- ============ BESTÄTIGUNG ============
CREATE TABLE public.delivery_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  opened_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_confirmation_tokens TO authenticated;
GRANT ALL ON public.delivery_confirmation_tokens TO service_role;
ALTER TABLE public.delivery_confirmation_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY dct_select ON public.delivery_confirmation_tokens FOR SELECT TO authenticated USING (public.can_plan_delivery());

CREATE TABLE public.delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  response text NOT NULL,
  alternative_date date,
  alternative_window_start time,
  alternative_window_end time,
  callback_requested boolean NOT NULL DEFAULT false,
  comment text,
  contact_name text,
  contact_phone text,
  corrected_address text,
  ip_address text,
  user_agent text,
  pdf_document_id uuid,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_confirmations TO authenticated;
GRANT ALL ON public.delivery_confirmations TO service_role;
ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dc_select ON public.delivery_confirmations FOR SELECT TO authenticated USING (public.can_view_delivery());

-- ============ E-MAIL / BENACHRICHTIGUNG ============
CREATE TABLE public.delivery_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  kind text NOT NULL,
  recipient text NOT NULL,
  cc text,
  bcc text,
  subject text,
  provider_id text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_email_logs TO authenticated;
GRANT ALL ON public.delivery_email_logs TO service_role;
ALTER TABLE public.delivery_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY del_select ON public.delivery_email_logs FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE INDEX idx_del_appointment ON public.delivery_email_logs(appointment_id, sent_at DESC);

CREATE TABLE public.delivery_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  target_user_id uuid,
  target_role text,
  channel text NOT NULL DEFAULT 'app',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.delivery_notifications TO authenticated;
GRANT ALL ON public.delivery_notifications TO service_role;
ALTER TABLE public.delivery_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY dn_select ON public.delivery_notifications FOR SELECT TO authenticated USING (target_user_id = auth.uid() OR public.can_view_delivery());
CREATE POLICY dn_update ON public.delivery_notifications FOR UPDATE TO authenticated USING (target_user_id = auth.uid() OR public.can_plan_delivery());

-- ============ BELADUNG ============
CREATE TABLE public.delivery_loading_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offen',
  checked_by uuid,
  checked_at timestamptz,
  total_weight_kg numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_loading_lists TO authenticated;
GRANT ALL ON public.delivery_loading_lists TO service_role;
ALTER TABLE public.delivery_loading_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY dll_select ON public.delivery_loading_lists FOR SELECT TO authenticated USING (
  public.can_view_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_tours t WHERE t.id = tour_id AND t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
CREATE POLICY dll_insert ON public.delivery_loading_lists FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dll_update ON public.delivery_loading_lists FOR UPDATE TO authenticated USING (
  public.can_plan_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_tours t WHERE t.id = tour_id AND t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
CREATE POLICY dll_delete ON public.delivery_loading_lists FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.delivery_loading_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loading_list_id uuid NOT NULL REFERENCES public.delivery_loading_lists(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 1,
  item_type text NOT NULL DEFAULT 'geraet',
  description text NOT NULL,
  serial_number text,
  quantity numeric NOT NULL DEFAULT 1,
  weight_kg numeric,
  dimensions text,
  load_position text,
  status public.delivery_loading_status NOT NULL DEFAULT 'nicht_vorbereitet',
  checked_by uuid,
  checked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_loading_items TO authenticated;
GRANT ALL ON public.delivery_loading_items TO service_role;
ALTER TABLE public.delivery_loading_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY dli_select ON public.delivery_loading_items FOR SELECT TO authenticated USING (
  public.can_view_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_loading_lists l JOIN public.delivery_tours t ON t.id = l.tour_id
             WHERE l.id = loading_list_id AND t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
CREATE POLICY dli_insert ON public.delivery_loading_items FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dli_update ON public.delivery_loading_items FOR UPDATE TO authenticated USING (
  public.can_plan_delivery()
  OR EXISTS (SELECT 1 FROM public.delivery_loading_lists l JOIN public.delivery_tours t ON t.id = l.tour_id
             WHERE l.id = loading_list_id AND t.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
CREATE POLICY dli_delete ON public.delivery_loading_items FOR DELETE TO authenticated USING (public.has_role('Super Admin') OR public.can_plan_delivery());

-- ============ CHECKLISTE / FREIGABE ============
CREATE TABLE public.delivery_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  is_blocking boolean NOT NULL DEFAULT true,
  checked_by uuid,
  checked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_checklists TO authenticated;
GRANT ALL ON public.delivery_checklists TO service_role;
ALTER TABLE public.delivery_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY dchk_select ON public.delivery_checklists FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dchk_insert ON public.delivery_checklists FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dchk_update ON public.delivery_checklists FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dchk_delete ON public.delivery_checklists FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ DOKUMENTE / FOTOS / UNTERSCHRIFTEN ============
CREATE TABLE public.delivery_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text,
  storage_path text,
  alixdocs_document_id uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_documents TO authenticated;
GRANT ALL ON public.delivery_documents TO service_role;
ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ddoc_select ON public.delivery_documents FOR SELECT TO authenticated USING (public.can_view_delivery() OR created_by = auth.uid());
CREATE POLICY ddoc_insert ON public.delivery_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY ddoc_update ON public.delivery_documents FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY ddoc_delete ON public.delivery_documents FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.delivery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'uebergabe',
  storage_path text NOT NULL,
  caption text,
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_photos TO authenticated;
GRANT ALL ON public.delivery_photos TO service_role;
ALTER TABLE public.delivery_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY dph_select ON public.delivery_photos FOR SELECT TO authenticated USING (public.can_view_delivery() OR created_by = auth.uid());
CREATE POLICY dph_insert ON public.delivery_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY dph_update ON public.delivery_photos FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dph_delete ON public.delivery_photos FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.delivery_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  signer_role text NOT NULL DEFAULT 'kunde',
  signer_name text,
  signature_path text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  gps_lat numeric,
  gps_lng numeric,
  gps_consent boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_signatures TO authenticated;
GRANT ALL ON public.delivery_signatures TO service_role;
ALTER TABLE public.delivery_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY dsig_select ON public.delivery_signatures FOR SELECT TO authenticated USING (public.can_view_delivery() OR created_by = auth.uid());
CREATE POLICY dsig_insert ON public.delivery_signatures FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============ VORFÄLLE / RÜCKNAHME ============
CREATE TABLE public.delivery_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  incident_type text NOT NULL,
  reason_code text,
  description text,
  returned_device text,
  returned_serial text,
  returned_condition text,
  returned_accessories text,
  replacement_device text,
  replacement_serial text,
  target_location text,
  follow_up_task_id uuid,
  extra_costs numeric,
  resolved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_incidents TO authenticated;
GRANT ALL ON public.delivery_incidents TO service_role;
ALTER TABLE public.delivery_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY dinc_select ON public.delivery_incidents FOR SELECT TO authenticated USING (public.can_view_delivery() OR created_by = auth.uid());
CREATE POLICY dinc_insert ON public.delivery_incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY dinc_update ON public.delivery_incidents FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dinc_delete ON public.delivery_incidents FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ KOSTEN / KM ============
CREATE TABLE public.delivery_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  order_id uuid,
  cost_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  quantity numeric,
  unit text,
  cost_center text,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_costs TO authenticated;
GRANT ALL ON public.delivery_costs TO service_role;
ALTER TABLE public.delivery_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcost_select ON public.delivery_costs FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dcost_insert ON public.delivery_costs FOR INSERT TO authenticated WITH CHECK (public.can_plan_delivery());
CREATE POLICY dcost_update ON public.delivery_costs FOR UPDATE TO authenticated USING (public.can_plan_delivery());
CREATE POLICY dcost_delete ON public.delivery_costs FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid REFERENCES public.delivery_tours(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  log_date date NOT NULL DEFAULT current_date,
  start_km numeric,
  end_km numeric,
  planned_km numeric,
  actual_km numeric,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mileage_logs TO authenticated;
GRANT ALL ON public.mileage_logs TO service_role;
ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY mlog_select ON public.mileage_logs FOR SELECT TO authenticated USING (public.can_view_delivery() OR created_by = auth.uid());
CREATE POLICY mlog_insert ON public.mileage_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY mlog_update ON public.mileage_logs FOR UPDATE TO authenticated USING (public.can_plan_delivery() OR created_by = auth.uid());
CREATE POLICY mlog_delete ON public.mileage_logs FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.route_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  origin text NOT NULL,
  destination text NOT NULL,
  distance_km numeric,
  duration_minutes numeric,
  toll boolean NOT NULL DEFAULT false,
  ferry boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'google',
  raw jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.route_calculations TO authenticated;
GRANT ALL ON public.route_calculations TO service_role;
ALTER TABLE public.route_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_select ON public.route_calculations FOR SELECT TO authenticated USING (public.can_view_delivery());

-- ============ EINSTELLUNGEN ============
CREATE TABLE public.delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_settings TO authenticated;
GRANT ALL ON public.delivery_settings TO service_role;
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY dset_select ON public.delivery_settings FOR SELECT TO authenticated USING (public.can_view_delivery());
CREATE POLICY dset_write ON public.delivery_settings FOR INSERT TO authenticated WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY dset_update ON public.delivery_settings FOR UPDATE TO authenticated USING (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY dset_delete ON public.delivery_settings FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

INSERT INTO public.delivery_settings (setting_key, setting_value, description) VALUES
 ('reminders', '{"first_hours":24,"second_hours":48,"internal_warning_hours":72,"channels":["email"],"enabled":true}', 'Erinnerungsfristen für Kundenbestätigung'),
 ('defaults', '{"duration_minutes":60,"work_minutes_max":480,"break_minutes":45,"token_valid_days":14,"km_rate":0.45}', 'Standardwerte für Planung'),
 ('customer_day_info', '{"enabled":false,"eta_notice_minutes":30,"channels":["email"]}', 'Automatische Kundeninformation am Liefertag');

-- ============ UPDATED_AT TRIGGER ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'delivery_locations','vehicles','vehicle_availability','vehicle_maintenance','drivers',
    'driver_qualifications','driver_availability','delivery_tours','delivery_appointments',
    'delivery_tour_stops','delivery_confirmation_tokens','delivery_loading_lists','delivery_loading_items',
    'delivery_checklists','delivery_incidents','delivery_costs','mileage_logs','delivery_settings'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- ============ STATUS HISTORY TRIGGER ============
CREATE OR REPLACE FUNCTION public.delivery_appointment_status_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_status_history(appointment_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status::text, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.delivery_status_history(appointment_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_da_status_log
AFTER INSERT OR UPDATE OF status ON public.delivery_appointments
FOR EACH ROW EXECUTE FUNCTION public.delivery_appointment_status_log();

CREATE OR REPLACE FUNCTION public.delivery_tour_status_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.delivery_status_history(tour_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_dt_status_log
AFTER UPDATE OF status ON public.delivery_tours
FOR EACH ROW EXECUTE FUNCTION public.delivery_tour_status_log();
