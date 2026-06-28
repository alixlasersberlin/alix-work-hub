
-- =========================================================
-- After Sales Management 2.0 - Phase 1 Migration
-- =========================================================

-- ---------- Rolle ----------
INSERT INTO public.roles (name) VALUES ('After Sales')
ON CONFLICT (name) DO NOTHING;

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.as_case_status AS ENUM ('open','in_progress','waiting_customer','blocked','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.as_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.as_traffic_light AS ENUM ('green','yellow','red');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.as_section AS ENUM ('erstkontakt','geraet','nisv','app','mediapaket','schulung','marketing','zufriedenheit','rueckruf','upselling');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.as_mediapaket_stage AS ENUM (
    'not_started','in_progress','data_requested','data_received','graphics_done','homepage_done','social_done','google_done','done','skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.as_reminder_kind AS ENUM ('login','app','nisv','schulung','mediapaket','callback','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Helper: updated_at ----------
CREATE OR REPLACE FUNCTION public.as_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ---------- Tabelle: as_cases ----------
CREATE TABLE IF NOT EXISTS public.as_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.lager_devices(id) ON DELETE SET NULL,
  assignee_id uuid,
  sales_user_name text,
  status public.as_case_status NOT NULL DEFAULT 'open',
  priority public.as_priority NOT NULL DEFAULT 'normal',
  traffic_light public.as_traffic_light NOT NULL DEFAULT 'yellow',
  progress_pct int NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  health_score int CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100),
  last_contact_at timestamptz,
  next_callback_at timestamptz,
  satisfaction_rating int CHECK (satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_note text,
  closed_at timestamptz,
  closed_by uuid,
  tenant_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_as_cases_status ON public.as_cases(status);
CREATE INDEX IF NOT EXISTS idx_as_cases_assignee ON public.as_cases(assignee_id);
CREATE INDEX IF NOT EXISTS idx_as_cases_customer ON public.as_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_as_cases_callback ON public.as_cases(next_callback_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.as_cases TO authenticated;
GRANT ALL ON public.as_cases TO service_role;

ALTER TABLE public.as_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "as_cases_select" ON public.as_cases FOR SELECT TO authenticated USING (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Vertrieb') OR public.has_role('Marketing') OR public.has_role('Service')
  OR public.has_role('Serviceleitung') OR public.has_role('Geschäftsführung')
  OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG') OR public.has_role('Kundenservice')
  OR public.has_role('Auftragsverwaltung')
);
CREATE POLICY "as_cases_insert" ON public.as_cases FOR INSERT TO authenticated WITH CHECK (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Vertrieb') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
);
CREATE POLICY "as_cases_update" ON public.as_cases FOR UPDATE TO authenticated USING (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Vertrieb') OR public.has_role('Marketing') OR public.has_role('Service')
  OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
);
CREATE POLICY "as_cases_delete" ON public.as_cases FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_as_cases_updated_at BEFORE UPDATE ON public.as_cases
FOR EACH ROW EXECUTE FUNCTION public.as_set_updated_at();

-- ---------- Tabelle: as_checklist_items ----------
CREATE TABLE IF NOT EXISTS public.as_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.as_cases(id) ON DELETE CASCADE,
  section public.as_section NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  checked_by uuid,
  note text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, section, item_key)
);
CREATE INDEX IF NOT EXISTS idx_as_checklist_case ON public.as_checklist_items(case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.as_checklist_items TO authenticated;
GRANT ALL ON public.as_checklist_items TO service_role;
ALTER TABLE public.as_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_check_select" ON public.as_checklist_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.as_cases c WHERE c.id = case_id)
);
CREATE POLICY "as_check_write" ON public.as_checklist_items FOR ALL TO authenticated USING (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Vertrieb') OR public.has_role('Marketing') OR public.has_role('Service')
  OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
) WITH CHECK (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Vertrieb') OR public.has_role('Marketing') OR public.has_role('Service')
  OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
);
CREATE TRIGGER trg_as_check_upd BEFORE UPDATE ON public.as_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.as_set_updated_at();

-- ---------- Tabelle: as_mediapaket_status ----------
CREATE TABLE IF NOT EXISTS public.as_mediapaket_status (
  case_id uuid PRIMARY KEY REFERENCES public.as_cases(id) ON DELETE CASCADE,
  stage public.as_mediapaket_stage NOT NULL DEFAULT 'not_started',
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.as_mediapaket_status TO authenticated;
GRANT ALL ON public.as_mediapaket_status TO service_role;
ALTER TABLE public.as_mediapaket_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_media_all" ON public.as_mediapaket_status FOR ALL TO authenticated USING (true) WITH CHECK (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Marketing') OR public.has_role('Vertrieb') OR public.has_role('SACHBEARBEITUNG')
);
CREATE TRIGGER trg_as_media_upd BEFORE UPDATE ON public.as_mediapaket_status
FOR EACH ROW EXECUTE FUNCTION public.as_set_updated_at();

-- ---------- Tabelle: as_timeline_events ----------
CREATE TABLE IF NOT EXISTS public.as_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.as_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  source text NOT NULL DEFAULT 'user',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_as_timeline_case ON public.as_timeline_events(case_id, created_at DESC);
GRANT SELECT, INSERT ON public.as_timeline_events TO authenticated;
GRANT ALL ON public.as_timeline_events TO service_role;
ALTER TABLE public.as_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_tl_select" ON public.as_timeline_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "as_tl_insert" ON public.as_timeline_events FOR INSERT TO authenticated WITH CHECK (true);

-- ---------- Tabelle: as_callbacks ----------
CREATE TABLE IF NOT EXISTS public.as_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.as_cases(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  priority public.as_priority NOT NULL DEFAULT 'normal',
  reason text,
  done_at timestamptz,
  done_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_as_cb_case ON public.as_callbacks(case_id);
CREATE INDEX IF NOT EXISTS idx_as_cb_due ON public.as_callbacks(due_at) WHERE done_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.as_callbacks TO authenticated;
GRANT ALL ON public.as_callbacks TO service_role;
ALTER TABLE public.as_callbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_cb_all" ON public.as_callbacks FOR ALL TO authenticated USING (true) WITH CHECK (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
  OR public.has_role('Vertrieb') OR public.has_role('Service') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
);

-- ---------- Tabelle: as_reminders ----------
CREATE TABLE IF NOT EXISTS public.as_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.as_cases(id) ON DELETE CASCADE,
  kind public.as_reminder_kind NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  channel text NOT NULL DEFAULT 'dashboard',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_as_rem_case ON public.as_reminders(case_id);
CREATE INDEX IF NOT EXISTS idx_as_rem_due ON public.as_reminders(scheduled_at) WHERE sent_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.as_reminders TO authenticated;
GRANT ALL ON public.as_reminders TO service_role;
ALTER TABLE public.as_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_rem_select" ON public.as_reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "as_rem_write" ON public.as_reminders FOR ALL TO authenticated USING (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
) WITH CHECK (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales')
);

-- ---------- Tabelle: as_upsell_suggestions ----------
CREATE TABLE IF NOT EXISTS public.as_upsell_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.as_cases(id) ON DELETE CASCADE,
  product_key text NOT NULL,
  label text NOT NULL,
  accepted boolean,
  offer_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.as_upsell_suggestions TO authenticated;
GRANT ALL ON public.as_upsell_suggestions TO service_role;
ALTER TABLE public.as_upsell_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_up_all" ON public.as_upsell_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (
  public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('After Sales') OR public.has_role('Vertrieb')
);
CREATE TRIGGER trg_as_up_upd BEFORE UPDATE ON public.as_upsell_suggestions
FOR EACH ROW EXECUTE FUNCTION public.as_set_updated_at();

-- ---------- Standard-Checklisten-Seed ----------
CREATE OR REPLACE FUNCTION public.as_seed_default_checklists(p_case uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.as_checklist_items (case_id, section, item_key, label, sort_order) VALUES
    (p_case,'erstkontakt','angerufen','Kunde angerufen',1),
    (p_case,'erstkontakt','erreicht','Kunde erreicht',2),
    (p_case,'erstkontakt','begruessung','Begrüßung durchgeführt',3),
    (p_case,'erstkontakt','ansprechpartner','Ansprechpartner bestätigt',4),
    (p_case,'geraet','geliefert','Gerät geliefert',1),
    (p_case,'geraet','aufgebaut','Gerät aufgebaut',2),
    (p_case,'geraet','betriebsbereit','Gerät betriebsbereit',3),
    (p_case,'geraet','funktion','Funktion geprüft',4),
    (p_case,'geraet','seriennummer','Seriennummer bestätigt',5),
    (p_case,'nisv','vorhanden','NiSV vorhanden',1),
    (p_case,'nisv','nachweis','Nachweis hochgeladen',2),
    (p_case,'nisv','erinnerung','Erinnerung versendet',3),
    (p_case,'app','download','App heruntergeladen',1),
    (p_case,'app','registriert','Registrierung erfolgt',2),
    (p_case,'app','login','Login erfolgreich',3),
    (p_case,'app','geraet_gekoppelt','Gerät gekoppelt',4),
    (p_case,'app','ai_aktiv','AI aktiviert',5),
    (p_case,'schulung','angeboten','Schulung angeboten',1),
    (p_case,'schulung','termin','Termin vereinbart',2),
    (p_case,'schulung','durchgefuehrt','Schulung durchgeführt',3),
    (p_case,'schulung','teilnehmer','Teilnehmer bestätigt',4),
    (p_case,'schulung','zertifikat','Zertifikat versendet',5),
    (p_case,'marketing','instagram','Instagram erklärt',1),
    (p_case,'marketing','google','Google Bewertungen erklärt',2),
    (p_case,'marketing','empfehlung','Empfehlungsprogramm erklärt',3),
    (p_case,'marketing','vorhernachher','Vorher/Nachher Bilder erhalten',4),
    (p_case,'marketing','werbung','Werbung gestartet',5),
    (p_case,'zufriedenheit','zufrieden','Kunde zufrieden',1),
    (p_case,'zufriedenheit','probleme','Probleme vorhanden',2),
    (p_case,'zufriedenheit','ticket','Service Ticket erstellt',3),
    (p_case,'zufriedenheit','verbesserung','Verbesserungsvorschläge aufgenommen',4)
  ON CONFLICT (case_id, section, item_key) DO NOTHING;

  INSERT INTO public.as_mediapaket_status (case_id, stage) VALUES (p_case,'not_started')
  ON CONFLICT (case_id) DO NOTHING;
END $$;

-- ---------- Trigger: Auto-Fall bei Orders-Status ----------
CREATE OR REPLACE FUNCTION public.as_on_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case_id uuid;
  v_device_id uuid;
BEGIN
  IF NEW.order_status IS NULL THEN RETURN NEW; END IF;
  IF NEW.order_status NOT IN ('approved','geliefert','teilgeliefert','versendet','invoiced') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.as_cases WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_device_id FROM public.lager_devices
    WHERE delivered_order_id = NEW.id OR reserved_order_id = NEW.id LIMIT 1;

  INSERT INTO public.as_cases (order_id, customer_id, device_id, sales_user_name, status, priority, traffic_light)
  VALUES (NEW.id, NEW.customer_id, v_device_id, NEW.salesperson_name, 'open', 'normal', 'yellow')
  RETURNING id INTO v_case_id;

  PERFORM public.as_seed_default_checklists(v_case_id);

  INSERT INTO public.as_timeline_events (case_id, event_type, title, body, source)
  VALUES (v_case_id, 'case_created', 'After-Sales-Fall automatisch erstellt',
          'Auslöser: Auftragsstatus = ' || NEW.order_status, 'system');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_as_on_order_status ON public.orders;
CREATE TRIGGER trg_as_on_order_status
AFTER INSERT OR UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.as_on_order_status_change();

-- ---------- Backfill für bestehende Aufträge ----------
DO $$
DECLARE r record; v_case uuid; v_dev uuid;
BEGIN
  FOR r IN
    SELECT o.id, o.customer_id, o.salesperson_name, o.order_status
    FROM public.orders o
    LEFT JOIN public.as_cases c ON c.order_id = o.id
    WHERE c.id IS NULL
      AND o.order_status IN ('approved','geliefert','teilgeliefert','versendet','invoiced')
    LIMIT 5000
  LOOP
    SELECT id INTO v_dev FROM public.lager_devices
      WHERE delivered_order_id = r.id OR reserved_order_id = r.id LIMIT 1;
    INSERT INTO public.as_cases (order_id, customer_id, device_id, sales_user_name, status, priority, traffic_light)
    VALUES (r.id, r.customer_id, v_dev, r.salesperson_name, 'open', 'normal', 'yellow')
    RETURNING id INTO v_case;
    PERFORM public.as_seed_default_checklists(v_case);
    INSERT INTO public.as_timeline_events (case_id, event_type, title, body, source)
    VALUES (v_case, 'case_created', 'After-Sales-Fall (Backfill)', 'Auftragsstatus: ' || r.order_status, 'system');
  END LOOP;
END $$;

-- ---------- View für Listenansicht ----------
CREATE OR REPLACE VIEW public.as_cases_list_v AS
SELECT
  c.id, c.order_id, c.customer_id, c.device_id, c.status, c.priority, c.traffic_light,
  c.progress_pct, c.health_score, c.last_contact_at, c.next_callback_at,
  c.sales_user_name, c.assignee_id, c.satisfaction_rating, c.created_at, c.updated_at, c.closed_at,
  o.order_number, o.internal_number, o.order_date, o.expected_shipment_date, o.total_amount, o.currency, o.order_status,
  cu.company_name AS customer_company, cu.contact_name AS customer_contact, cu.email AS customer_email,
  cu.phone AS customer_phone, cu.external_customer_id AS customer_number, cu.is_vip,
  d.serial_number AS device_serial, d.model_name AS device_model
FROM public.as_cases c
LEFT JOIN public.orders o ON o.id = c.order_id
LEFT JOIN public.customers cu ON cu.id = c.customer_id
LEFT JOIN public.lager_devices d ON d.id = c.device_id;

GRANT SELECT ON public.as_cases_list_v TO authenticated;
