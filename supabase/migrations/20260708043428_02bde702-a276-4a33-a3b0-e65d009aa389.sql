
-- ESC Enterprise Scheduling Center - Full schema, RLS, seeds, audit

CREATE OR REPLACE FUNCTION public.esc_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.esc_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Geschäftsleitung');
$$;

-- plpgsql defers name resolution so tables can be referenced before they exist
CREATE OR REPLACE FUNCTION public.esc_user_department_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT department_id FROM public.esc_employee_departments WHERE user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.esc_is_department_lead(_user_id uuid, _department_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.esc_departments WHERE id = _department_id AND department_lead_user_id = _user_id) INTO v_exists;
  RETURN v_exists;
END; $$;

CREATE OR REPLACE FUNCTION public.esc_generate_token()
RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT encode(gen_random_bytes(32), 'hex'); $$;

-- 1) esc_departments
CREATE TABLE public.esc_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, description text,
  color text NOT NULL DEFAULT '#6B7280', icon text,
  is_active boolean NOT NULL DEFAULT true,
  is_public_bookable boolean NOT NULL DEFAULT false,
  default_duration_minutes integer NOT NULL DEFAULT 60,
  default_location text, default_email_template_id uuid,
  department_lead_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_departments TO authenticated;
GRANT SELECT ON public.esc_departments TO anon;
GRANT ALL ON public.esc_departments TO service_role;
ALTER TABLE public.esc_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_dept_admin_all" ON public.esc_departments FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_dept_auth_read" ON public.esc_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "esc_dept_public_read" ON public.esc_departments FOR SELECT TO anon USING (is_active AND is_public_bookable);
CREATE TRIGGER trg_esc_departments_updated BEFORE UPDATE ON public.esc_departments
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 2) esc_employee_departments
CREATE TABLE public.esc_employee_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.esc_departments(id) ON DELETE CASCADE,
  role_in_department text, is_primary boolean NOT NULL DEFAULT false,
  is_public_bookable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  UNIQUE (user_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_employee_departments TO authenticated;
GRANT ALL ON public.esc_employee_departments TO service_role;
ALTER TABLE public.esc_employee_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_empdept_admin_all" ON public.esc_employee_departments FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_empdept_auth_read" ON public.esc_employee_departments FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_esc_empdept_user ON public.esc_employee_departments(user_id);
CREATE INDEX idx_esc_empdept_dept ON public.esc_employee_departments(department_id);

-- 3) esc_employee_settings
CREATE TABLE public.esc_employee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  calendar_color text NOT NULL DEFAULT '#3B82F6',
  working_hours_json jsonb NOT NULL DEFAULT '{"mon":{"start":"08:00","end":"17:00"},"tue":{"start":"08:00","end":"17:00"},"wed":{"start":"08:00","end":"17:00"},"thu":{"start":"08:00","end":"17:00"},"fri":{"start":"08:00","end":"17:00"},"sat":null,"sun":null}'::jsonb,
  visible_in_public_booking boolean NOT NULL DEFAULT false,
  default_location text,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  max_bookings_per_day integer,
  timezone text NOT NULL DEFAULT 'Europe/Berlin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_employee_settings TO authenticated;
GRANT ALL ON public.esc_employee_settings TO service_role;
ALTER TABLE public.esc_employee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_empset_admin_all" ON public.esc_employee_settings FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_empset_self_all" ON public.esc_employee_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "esc_empset_auth_read" ON public.esc_employee_settings FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_esc_empset_updated BEFORE UPDATE ON public.esc_employee_settings
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 4) esc_event_types
CREATE TABLE public.esc_event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.esc_departments(id) ON DELETE SET NULL,
  name text NOT NULL, slug text NOT NULL UNIQUE, description text,
  color text NOT NULL DEFAULT '#6B7280', icon text,
  default_duration_minutes integer NOT NULL DEFAULT 60,
  requires_confirmation_default boolean NOT NULL DEFAULT false,
  is_public_bookable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_event_types TO authenticated;
GRANT SELECT ON public.esc_event_types TO anon;
GRANT ALL ON public.esc_event_types TO service_role;
ALTER TABLE public.esc_event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_evtype_admin_all" ON public.esc_event_types FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_evtype_auth_read" ON public.esc_event_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "esc_evtype_public_read" ON public.esc_event_types FOR SELECT TO anon USING (is_active AND is_public_bookable);
CREATE TRIGGER trg_esc_evtype_updated BEFORE UPDATE ON public.esc_event_types
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 5) esc_resources
CREATE TABLE public.esc_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('room','device','vehicle','showroom','training_room','meeting_room','equipment','other')),
  description text, location text, capacity integer,
  color text NOT NULL DEFAULT '#6B7280',
  is_active boolean NOT NULL DEFAULT true,
  is_public_bookable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_resources TO authenticated;
GRANT ALL ON public.esc_resources TO service_role;
ALTER TABLE public.esc_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_res_admin_all" ON public.esc_resources FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_res_auth_read" ON public.esc_resources FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_esc_res_updated BEFORE UPDATE ON public.esc_resources
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 6) esc_events
CREATE TABLE public.esc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Berlin',
  all_day boolean NOT NULL DEFAULT false,
  department_id uuid NOT NULL REFERENCES public.esc_departments(id) ON DELETE RESTRICT,
  event_type_id uuid REFERENCES public.esc_event_types(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','requested','confirmation_pending','confirmed','declined','rescheduled','cancelled','completed','no_show')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  location text, address text,
  room_id uuid REFERENCES public.esc_resources(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES public.esc_resources(id) ON DELETE SET NULL,
  device_id uuid,
  vehicle_id uuid REFERENCES public.esc_resources(id) ON DELETE SET NULL,
  customer_id uuid, customer_name text, customer_email text, customer_phone text, contact_person text,
  assigned_user_id uuid, created_by uuid, updated_by uuid,
  internal_note text, external_note text,
  requires_confirmation boolean NOT NULL DEFAULT false,
  confirmation_status text NOT NULL DEFAULT 'not_required' CHECK (confirmation_status IN ('not_required','pending','confirmed','declined','alternative_requested')),
  confirmation_token text UNIQUE, confirmation_token_expires_at timestamptz,
  public_booking_id uuid, recurrence_rule text,
  parent_event_id uuid REFERENCES public.esc_events(id) ON DELETE SET NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  is_public_booking boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'internal',
  ics_uid text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (end_at >= start_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_events TO authenticated;
GRANT ALL ON public.esc_events TO service_role;
ALTER TABLE public.esc_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_events_admin_all" ON public.esc_events FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_events_assigned_read" ON public.esc_events FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (assigned_user_id = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "esc_events_assigned_update" ON public.esc_events FOR UPDATE TO authenticated
  USING (assigned_user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assigned_user_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "esc_events_dept_read" ON public.esc_events FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND department_id IN (SELECT public.esc_user_department_ids(auth.uid())));
CREATE POLICY "esc_events_lead_update" ON public.esc_events FOR UPDATE TO authenticated
  USING (public.esc_is_department_lead(auth.uid(), department_id))
  WITH CHECK (public.esc_is_department_lead(auth.uid(), department_id));
CREATE POLICY "esc_events_auth_insert" ON public.esc_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    assigned_user_id = auth.uid()
    OR department_id IN (SELECT public.esc_user_department_ids(auth.uid()))
    OR public.esc_is_admin()
  ));
CREATE INDEX idx_esc_events_start ON public.esc_events(start_at);
CREATE INDEX idx_esc_events_end ON public.esc_events(end_at);
CREATE INDEX idx_esc_events_dept ON public.esc_events(department_id);
CREATE INDEX idx_esc_events_user ON public.esc_events(assigned_user_id);
CREATE INDEX idx_esc_events_status ON public.esc_events(status);
CREATE INDEX idx_esc_events_customer ON public.esc_events(customer_id);
CREATE INDEX idx_esc_events_conf_token ON public.esc_events(confirmation_token);
CREATE INDEX idx_esc_events_deleted ON public.esc_events(deleted_at);
CREATE TRIGGER trg_esc_events_updated BEFORE UPDATE ON public.esc_events
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 7) esc_event_participants
CREATE TABLE public.esc_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.esc_events(id) ON DELETE CASCADE,
  participant_type text NOT NULL CHECK (participant_type IN ('internal_user','customer','partner','external_guest')),
  user_id uuid, customer_id uuid, name text, email text, phone text, role text,
  confirmation_status text NOT NULL DEFAULT 'not_required' CHECK (confirmation_status IN ('not_required','pending','confirmed','declined','alternative_requested')),
  confirmation_token text UNIQUE,
  confirmation_sent_at timestamptz, confirmed_at timestamptz, declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_event_participants TO authenticated;
GRANT ALL ON public.esc_event_participants TO service_role;
ALTER TABLE public.esc_event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_part_admin_all" ON public.esc_event_participants FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_part_via_event_read" ON public.esc_event_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = event_id AND e.deleted_at IS NULL
    AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid()
         OR e.department_id IN (SELECT public.esc_user_department_ids(auth.uid())))));
CREATE POLICY "esc_part_via_event_write" ON public.esc_event_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = event_id
    AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid()
         OR public.esc_is_department_lead(auth.uid(), e.department_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = event_id
    AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid()
         OR public.esc_is_department_lead(auth.uid(), e.department_id))));
CREATE INDEX idx_esc_part_event ON public.esc_event_participants(event_id);
CREATE INDEX idx_esc_part_token ON public.esc_event_participants(confirmation_token);
CREATE TRIGGER trg_esc_part_updated BEFORE UPDATE ON public.esc_event_participants
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 8) esc_event_resources
CREATE TABLE public.esc_event_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.esc_events(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.esc_resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (event_id, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_event_resources TO authenticated;
GRANT ALL ON public.esc_event_resources TO service_role;
ALTER TABLE public.esc_event_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_evres_admin_all" ON public.esc_event_resources FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_evres_auth_read" ON public.esc_event_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "esc_evres_via_event_write" ON public.esc_event_resources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = event_id
    AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = event_id
    AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid())));
CREATE INDEX idx_esc_evres_event ON public.esc_event_resources(event_id);
CREATE INDEX idx_esc_evres_resource ON public.esc_event_resources(resource_id);

-- 9) esc_public_bookings
CREATE TABLE public.esc_public_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL UNIQUE DEFAULT ('ESC-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,8)),
  department_id uuid NOT NULL REFERENCES public.esc_departments(id) ON DELETE RESTRICT,
  event_type_id uuid REFERENCES public.esc_event_types(id) ON DELETE SET NULL,
  preferred_start_at timestamptz NOT NULL,
  preferred_end_at timestamptz,
  timezone text NOT NULL DEFAULT 'Europe/Berlin',
  customer_name text NOT NULL, company_name text,
  customer_email text NOT NULL, customer_phone text, message text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','converted_to_event','cancelled')),
  created_event_id uuid REFERENCES public.esc_events(id) ON DELETE SET NULL,
  confirmation_token text NOT NULL UNIQUE DEFAULT public.esc_generate_token(),
  source text NOT NULL DEFAULT 'public_portal',
  ip_address text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_public_bookings TO authenticated;
GRANT INSERT ON public.esc_public_bookings TO anon;
GRANT ALL ON public.esc_public_bookings TO service_role;
ALTER TABLE public.esc_public_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_pub_admin_all" ON public.esc_public_bookings FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_pub_dept_read" ON public.esc_public_bookings FOR SELECT TO authenticated
  USING (department_id IN (SELECT public.esc_user_department_ids(auth.uid())));
CREATE POLICY "esc_pub_dept_update" ON public.esc_public_bookings FOR UPDATE TO authenticated
  USING (public.esc_is_department_lead(auth.uid(), department_id))
  WITH CHECK (public.esc_is_department_lead(auth.uid(), department_id));
CREATE POLICY "esc_pub_anon_insert" ON public.esc_public_bookings FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.esc_departments d
    WHERE d.id = department_id AND d.is_active AND d.is_public_bookable));
CREATE INDEX idx_esc_pub_token ON public.esc_public_bookings(confirmation_token);
CREATE INDEX idx_esc_pub_dept ON public.esc_public_bookings(department_id);
CREATE INDEX idx_esc_pub_status ON public.esc_public_bookings(status);
CREATE TRIGGER trg_esc_pub_updated BEFORE UPDATE ON public.esc_public_bookings
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

-- 10) esc_email_templates
CREATE TABLE public.esc_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('event_confirmation','event_reminder','booking_request_received','booking_approved','booking_declined','event_rescheduled','event_cancelled')),
  subject text NOT NULL, body_html text NOT NULL, body_text text,
  department_id uuid REFERENCES public.esc_departments(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_email_templates TO authenticated;
GRANT ALL ON public.esc_email_templates TO service_role;
ALTER TABLE public.esc_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_tpl_admin_all" ON public.esc_email_templates FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_tpl_auth_read" ON public.esc_email_templates FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_esc_tpl_updated BEFORE UPDATE ON public.esc_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.esc_set_updated_at();

ALTER TABLE public.esc_departments
  ADD CONSTRAINT esc_dept_default_tpl_fk
  FOREIGN KEY (default_email_template_id) REFERENCES public.esc_email_templates(id) ON DELETE SET NULL;

-- 11) esc_event_emails
CREATE TABLE public.esc_event_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.esc_events(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.esc_event_participants(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.esc_email_templates(id) ON DELETE SET NULL,
  recipient_email text NOT NULL, subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','opened','clicked')),
  provider_message_id text,
  sent_at timestamptz, opened_at timestamptz, clicked_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_event_emails TO authenticated;
GRANT ALL ON public.esc_event_emails TO service_role;
ALTER TABLE public.esc_event_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_evm_admin_all" ON public.esc_event_emails FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_evm_via_event_read" ON public.esc_event_emails FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = event_id
    AND (e.assigned_user_id = auth.uid() OR e.created_by = auth.uid()
         OR e.department_id IN (SELECT public.esc_user_department_ids(auth.uid())))));
CREATE INDEX idx_esc_evm_event ON public.esc_event_emails(event_id);

-- 12) esc_audit_log
CREATE TABLE public.esc_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('event','department','resource','employee_setting','public_booking','email_template','event_participant')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created','updated','deleted','restored','status_changed','confirmation_sent','confirmed','declined')),
  old_values_json jsonb, new_values_json jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text, user_agent text, source text
);
GRANT SELECT, INSERT ON public.esc_audit_log TO authenticated;
GRANT ALL ON public.esc_audit_log TO service_role;
ALTER TABLE public.esc_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_audit_admin_read" ON public.esc_audit_log FOR SELECT TO authenticated USING (public.esc_is_admin());
CREATE POLICY "esc_audit_insert_auth" ON public.esc_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_esc_audit_entity ON public.esc_audit_log(entity_type, entity_id);
CREATE INDEX idx_esc_audit_changed_at ON public.esc_audit_log(changed_at DESC);

-- 13) esc_ics_tokens
CREATE TABLE public.esc_ics_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  department_id uuid REFERENCES public.esc_departments(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT public.esc_generate_token(),
  feed_type text NOT NULL CHECK (feed_type IN ('user_calendar','department_calendar','resource_calendar','public_event')),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_ics_tokens TO authenticated;
GRANT ALL ON public.esc_ics_tokens TO service_role;
ALTER TABLE public.esc_ics_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_ics_admin_all" ON public.esc_ics_tokens FOR ALL TO authenticated
  USING (public.esc_is_admin()) WITH CHECK (public.esc_is_admin());
CREATE POLICY "esc_ics_self_all" ON public.esc_ics_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_esc_ics_token ON public.esc_ics_tokens(token);
CREATE INDEX idx_esc_ics_user ON public.esc_ics_tokens(user_id);

-- Audit trigger
CREATE OR REPLACE FUNCTION public.esc_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_action text;
  v_entity_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created'; v_entity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'esc_events' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'deleted';
    ELSIF TG_TABLE_NAME = 'esc_events' AND OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_changed';
    ELSE
      v_action := 'updated';
    END IF;
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted'; v_entity_id := OLD.id;
  END IF;
  INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, new_values_json, changed_by, source)
  VALUES (v_entity_type, v_entity_id, v_action,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(), 'trigger');
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_esc_events_audit AFTER INSERT OR UPDATE OR DELETE ON public.esc_events
  FOR EACH ROW EXECUTE FUNCTION public.esc_audit_trigger('event');
CREATE TRIGGER trg_esc_pub_audit AFTER INSERT OR UPDATE OR DELETE ON public.esc_public_bookings
  FOR EACH ROW EXECUTE FUNCTION public.esc_audit_trigger('public_booking');
CREATE TRIGGER trg_esc_part_audit AFTER INSERT OR UPDATE OR DELETE ON public.esc_event_participants
  FOR EACH ROW EXECUTE FUNCTION public.esc_audit_trigger('event_participant');

-- Seeds: Departments
INSERT INTO public.esc_departments (name, slug, color, icon, is_public_bookable, default_duration_minutes) VALUES
  ('Sales','sales','#3B82F6','TrendingUp',true,60),
  ('Service','service','#10B981','Wrench',true,60),
  ('Lieferung','lieferung','#F59E0B','Truck',false,90),
  ('Mediapaket','mediapaket','#8B5CF6','Camera',true,60),
  ('Schulung','schulung','#EC4899','GraduationCap',true,120),
  ('NiSV Schulung Virtuell','nisv-virtuell','#06B6D4','Monitor',true,180),
  ('NiSV Präsenz','nisv-praesenz','#0EA5E9','Users',true,480),
  ('Marketing','marketing','#F97316','Megaphone',false,60),
  ('Technik','technik','#6366F1','Cpu',false,60),
  ('Buchhaltung','buchhaltung','#84CC16','Calculator',false,60),
  ('Administration','administration','#64748B','Settings',false,60),
  ('Geschäftsleitung','geschaeftsleitung','#EF4444','Crown',false,60)
ON CONFLICT (slug) DO NOTHING;

-- Seeds: Event Types
INSERT INTO public.esc_event_types (department_id, name, slug, color, default_duration_minutes, requires_confirmation_default, is_public_bookable) VALUES
  ((SELECT id FROM public.esc_departments WHERE slug='sales'),'Sales Beratung','sales-beratung','#3B82F6',60,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='sales'),'Online Demo','online-demo','#3B82F6',45,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='sales'),'Kundentermin','kundentermin','#3B82F6',60,true,false),
  ((SELECT id FROM public.esc_departments WHERE slug='lieferung'),'Geräteauslieferung','geraeteauslieferung','#F59E0B',90,true,false),
  ((SELECT id FROM public.esc_departments WHERE slug='service'),'Installation','installation','#10B981',120,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='service'),'Serviceeinsatz','serviceeinsatz','#10B981',90,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='service'),'Wartung','wartung','#10B981',60,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='service'),'Reparatur','reparatur','#10B981',120,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='schulung'),'Geräteeinweisung','geraeteeinweisung','#EC4899',60,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='schulung'),'Schulung','schulung-termin','#EC4899',120,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='nisv-virtuell'),'NiSV Virtuell','nisv-virtuell-termin','#06B6D4',180,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='nisv-praesenz'),'NiSV Präsenz','nisv-praesenz-termin','#0EA5E9',480,true,true),
  ((SELECT id FROM public.esc_departments WHERE slug='mediapaket'),'Mediapaket Termin','mediapaket-termin','#8B5CF6',60,true,true),
  (NULL,'Internes Meeting','internes-meeting','#64748B',60,false,false)
ON CONFLICT (slug) DO NOTHING;

-- Seeds: Email Templates
INSERT INTO public.esc_email_templates (name, template_type, subject, body_html, body_text, is_default, is_active) VALUES
  ('Terminbestätigung','event_confirmation','Bitte bestätigen Sie Ihren Termin bei AlixWorks',
    '<p>Hallo {{customer_name}},</p><p>bitte bestätigen Sie Ihren Termin am {{start_at}}.</p><p><a href="https://alixworks.de/termin-bestaetigen/{{token}}">Termin bestätigen</a></p>',
    'Hallo {{customer_name}}, bitte bestätigen Sie Ihren Termin: https://alixworks.de/termin-bestaetigen/{{token}}', true, true),
  ('Terminerinnerung','event_reminder','Erinnerung: Ihr Termin bei AlixWorks am {{start_at}}',
    '<p>Hallo {{customer_name}}, wir erinnern an Ihren Termin am {{start_at}}.</p>',
    'Erinnerung: Termin am {{start_at}}', true, true),
  ('Buchungsanfrage erhalten','booking_request_received','Ihre Buchungsanfrage bei AlixWorks',
    '<p>Danke, {{customer_name}}. Anfrage {{booking_number}} eingegangen.</p>',
    'Anfrage {{booking_number}} eingegangen.', true, true),
  ('Buchung angenommen','booking_approved','Ihre Buchung wurde bestätigt',
    '<p>Buchung {{booking_number}} bestätigt für {{start_at}}.</p>',
    'Buchung {{booking_number}} bestätigt.', true, true),
  ('Buchung abgelehnt','booking_declined','Ihre Buchungsanfrage bei AlixWorks',
    '<p>Leider können wir Ihren Wunschtermin nicht anbieten.</p>',
    'Wunschtermin leider nicht verfügbar.', true, true),
  ('Termin verschoben','event_rescheduled','Ihr Termin wurde verschoben',
    '<p>Ihr Termin wurde verschoben auf {{start_at}}.</p>',
    'Termin verschoben auf {{start_at}}.', true, true),
  ('Termin storniert','event_cancelled','Ihr Termin wurde storniert',
    '<p>Ihr Termin am {{start_at}} wurde storniert.</p>',
    'Termin am {{start_at}} storniert.', true, true);
