
-- ============ ALIX Feedback & Rewards : Fundament ============
CREATE OR REPLACE FUNCTION public.sv_can_read()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Marketing')
      OR public.has_role('Management') OR public.has_role('Geschäftsführung') OR public.has_role('Service')
      OR public.has_role('Vertrieb') OR public.has_role('Verkauf') OR public.has_role('QM');
$$;

CREATE OR REPLACE FUNCTION public.sv_can_write()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Marketing');
$$;

CREATE OR REPLACE FUNCTION public.sv_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW; END; $$;

-- ---------- surveys ----------
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  internal_note text,
  public_title text,
  intro_text text,
  outro_text text,
  language text NOT NULL DEFAULT 'de',
  languages text[] NOT NULL DEFAULT ARRAY['de'],
  starts_at timestamptz,
  ends_at timestamptz,
  est_minutes integer DEFAULT 5,
  target_group text,
  device_model text,
  owner_user_id uuid,
  reward_id uuid,
  reminders_enabled boolean NOT NULL DEFAULT true,
  reminder_days integer[] NOT NULL DEFAULT ARRAY[7,14,21],
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'entwurf',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  title text,
  description text,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.survey_sections(id) ON DELETE SET NULL,
  qtype text NOT NULL DEFAULT 'text',
  label text NOT NULL,
  help_text text,
  position integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT false,
  internal_number text,
  category text,
  weight numeric DEFAULT 1,
  points numeric,
  min_value numeric,
  max_value numeric,
  min_length integer,
  max_length integer,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text,
  position integer NOT NULL DEFAULT 0,
  score numeric,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_logic_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  source_question_id uuid REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  operator text NOT NULL DEFAULT 'eq',
  compare_value jsonb,
  action text NOT NULL DEFAULT 'show',
  target_question_id uuid REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  target_section_id uuid REFERENCES public.survey_sections(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE SET NULL,
  file_name text,
  file_path text,
  mime_type text,
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  question_count integer DEFAULT 0,
  error_text text,
  status text NOT NULL DEFAULT 'hochgeladen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  language text NOT NULL DEFAULT 'de',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_library_question boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'aktiv',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

-- ---------- rewards ----------
CREATE TABLE public.survey_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  reward_type text NOT NULL DEFAULT 'gutschein',
  image_url text,
  value_amount numeric,
  currency text DEFAULT 'EUR',
  valid_from date,
  valid_to date,
  stock_total integer,
  stock_used integer NOT NULL DEFAULT 0,
  max_per_survey integer,
  generic_code text,
  code_mode text NOT NULL DEFAULT 'generic',
  conditions text,
  requires_shipping boolean NOT NULL DEFAULT false,
  department text,
  auto_email boolean NOT NULL DEFAULT true,
  download_path text,
  status text NOT NULL DEFAULT 'aktiv',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_reward_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.survey_rewards(id) ON DELETE CASCADE,
  code text NOT NULL,
  assigned_to_recipient_id uuid,
  assigned_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'frei',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (reward_id, code)
);

-- ---------- recipients / invitations ----------
CREATE TABLE public.survey_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_number text,
  company_name text,
  first_name text,
  last_name text,
  email text NOT NULL,
  language text NOT NULL DEFAULT 'de',
  country text,
  device_model text,
  serial_number text,
  order_number text,
  salesperson text,
  consent_status text NOT NULL DEFAULT 'unbekannt',
  unsubscribed_at timestamptz,
  status text NOT NULL DEFAULT 'eingeladen_offen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (survey_id, email)
);

CREATE TABLE public.survey_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.survey_recipients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  pin_code text,
  multi_use boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  status text NOT NULL DEFAULT 'vorbereitet',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES public.survey_invitations(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  language text NOT NULL DEFAULT 'de',
  draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  user_agent text,
  status text NOT NULL DEFAULT 'begonnen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.survey_sessions(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  customer_id uuid,
  device_model text,
  serial_number text,
  order_number text,
  language text NOT NULL DEFAULT 'de',
  score_total numeric,
  nps_score integer,
  is_critical boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  reward_status text NOT NULL DEFAULT 'vorgesehen',
  status text NOT NULL DEFAULT 'abgeschlossen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.survey_response_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.survey_questions(id) ON DELETE SET NULL,
  question_label text,
  qtype text,
  value_text text,
  value_number numeric,
  value_date date,
  value_bool boolean,
  value_json jsonb,
  file_path text,
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.survey_reward_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.survey_rewards(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  response_id uuid REFERENCES public.survey_responses(id) ON DELETE SET NULL,
  code_id uuid REFERENCES public.survey_reward_codes(id) ON DELETE SET NULL,
  code_text text,
  issued_at timestamptz,
  emailed_at timestamptz,
  downloaded_at timestamptz,
  shipped_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'vorgesehen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- ---------- e-mail ----------
CREATE TABLE public.survey_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'einladung',
  language text NOT NULL DEFAULT 'de',
  subject text NOT NULL DEFAULT '',
  from_name text,
  from_email text,
  reply_to text,
  body_html text NOT NULL DEFAULT '',
  tracking_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.survey_invitations(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.survey_email_templates(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'einladung',
  to_email text,
  subject text,
  provider_id text,
  error_text text,
  attempt integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'vorbereitet',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- ---------- consents / exports / ai / alerts / testimonials / audit ----------
CREATE TABLE public.survey_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  response_id uuid REFERENCES public.survey_responses(id) ON DELETE SET NULL,
  consent_type text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  source text,
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.survey_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'csv',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  anonymized boolean NOT NULL DEFAULT false,
  file_path text,
  row_count integer,
  status text NOT NULL DEFAULT 'erstellt',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'gesamt',
  summary_text text,
  positives jsonb NOT NULL DEFAULT '[]'::jsonb,
  negatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  clusters jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'vorschlag',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.survey_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  rule_name text,
  severity text NOT NULL DEFAULT 'hoch',
  reason text,
  ticket_id uuid,
  assigned_to uuid,
  due_at timestamptz,
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'offen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.survey_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.survey_responses(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  quote text NOT NULL,
  author_name text,
  company_name text,
  allow_internal boolean NOT NULL DEFAULT false,
  allow_website boolean NOT NULL DEFAULT false,
  allow_name boolean NOT NULL DEFAULT false,
  allow_company boolean NOT NULL DEFAULT false,
  allow_logo boolean NOT NULL DEFAULT false,
  allow_interview boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'eingereicht',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.survey_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid,
  entity_table text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid DEFAULT auth.uid(),
  actor_email text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.surveys ADD CONSTRAINT surveys_reward_fk FOREIGN KEY (reward_id) REFERENCES public.survey_rewards(id) ON DELETE SET NULL;
ALTER TABLE public.survey_reward_codes ADD CONSTRAINT srcodes_recipient_fk FOREIGN KEY (assigned_to_recipient_id) REFERENCES public.survey_recipients(id) ON DELETE SET NULL;

-- indexes
CREATE INDEX idx_sv_questions_survey ON public.survey_questions(survey_id, position);
CREATE INDEX idx_sv_options_question ON public.survey_question_options(question_id, position);
CREATE INDEX idx_sv_recipients_survey ON public.survey_recipients(survey_id);
CREATE INDEX idx_sv_invitations_survey ON public.survey_invitations(survey_id);
CREATE INDEX idx_sv_responses_survey ON public.survey_responses(survey_id, completed_at DESC);
CREATE INDEX idx_sv_resp_items_response ON public.survey_response_items(response_id);
CREATE INDEX idx_sv_email_logs_survey ON public.survey_email_logs(survey_id, created_at DESC);
CREATE INDEX idx_sv_alerts_survey ON public.survey_alerts(survey_id, status);
CREATE INDEX idx_sv_audit_entity ON public.survey_audit_logs(entity_table, entity_id, created_at DESC);

-- grants + RLS + policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'surveys','survey_sections','survey_questions','survey_question_options','survey_logic_rules',
    'survey_imports','survey_templates','survey_rewards','survey_reward_codes','survey_recipients',
    'survey_invitations','survey_sessions','survey_responses','survey_response_items',
    'survey_reward_assignments','survey_email_templates','survey_email_logs','survey_consents',
    'survey_exports','survey_ai_summaries','survey_alerts','survey_testimonials','survey_audit_logs']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.sv_can_read())', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.sv_can_write())', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.sv_can_write()) WITH CHECK (public.sv_can_write())', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(''Super Admin''))', t||'_del', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'surveys','survey_sections','survey_questions','survey_question_options','survey_logic_rules',
    'survey_imports','survey_templates','survey_rewards','survey_reward_codes','survey_recipients',
    'survey_invitations','survey_sessions','survey_responses','survey_response_items',
    'survey_reward_assignments','survey_email_templates','survey_email_logs','survey_consents',
    'survey_exports','survey_ai_summaries','survey_alerts','survey_testimonials']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sv_touch()', t||'_touch', t);
  END LOOP;
END $$;
