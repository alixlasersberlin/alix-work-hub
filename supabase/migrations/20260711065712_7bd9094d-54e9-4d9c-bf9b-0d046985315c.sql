
CREATE TABLE IF NOT EXISTS public.esc_ech_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  template_slug text,
  language text DEFAULT 'de',
  recipient text NOT NULL,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  retry_count integer NOT NULL DEFAULT 0,
  error text,
  refs jsonb DEFAULT '{}'::jsonb,
  event_id uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_ech_messages TO authenticated;
GRANT ALL ON public.esc_ech_messages TO service_role;
ALTER TABLE public.esc_ech_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ech_msgs_read_auth" ON public.esc_ech_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "ech_msgs_write_admin" ON public.esc_ech_messages FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.esc_ech_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  channel text NOT NULL,
  language text NOT NULL DEFAULT 'de',
  subject text,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, channel, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_ech_templates TO authenticated;
GRANT ALL ON public.esc_ech_templates TO service_role;
ALTER TABLE public.esc_ech_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ech_tpl_read_auth" ON public.esc_ech_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "ech_tpl_write_admin" ON public.esc_ech_templates FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

CREATE OR REPLACE FUNCTION public.esc_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_ech_msgs_touch ON public.esc_ech_messages;
CREATE TRIGGER trg_ech_msgs_touch BEFORE UPDATE ON public.esc_ech_messages
  FOR EACH ROW EXECUTE FUNCTION public.esc_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ech_tpl_touch ON public.esc_ech_templates;
CREATE TRIGGER trg_ech_tpl_touch BEFORE UPDATE ON public.esc_ech_templates
  FOR EACH ROW EXECUTE FUNCTION public.esc_touch_updated_at();

ALTER TABLE public.esc_ics_tokens
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS event_id uuid;

CREATE OR REPLACE FUNCTION public.esc_audit_trigger() RETURNS TRIGGER AS $$
DECLARE v_entity uuid; v_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_entity := OLD.id; v_action := 'DELETE';
  ELSIF TG_OP = 'UPDATE' THEN v_entity := NEW.id; v_action := 'UPDATE';
  ELSE v_entity := NEW.id; v_action := 'INSERT';
  END IF;
  INSERT INTO public.esc_audit_log (entity_type, entity_id, action, user_id, old_data, new_data, created_at)
  VALUES (
    TG_TABLE_NAME, v_entity, v_action, auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['esc_events','esc_event_participants','esc_event_resources','esc_public_bookings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_audit AFTER INSERT OR UPDATE OR DELETE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.esc_audit_trigger()', t, t);
  END LOOP;
END $$;
