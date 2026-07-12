
-- =========================================================
-- Phase 3.1: In-App Notifications
-- =========================================================
CREATE TABLE public.role_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  ref_type text,
  ref_id uuid,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_role_notif_user ON public.role_notifications(user_id, read_at, created_at DESC);

GRANT SELECT, UPDATE ON public.role_notifications TO authenticated;
GRANT ALL ON public.role_notifications TO service_role;
ALTER TABLE public.role_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own notifications" ON public.role_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Mark own as read" ON public.role_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Helper: notify all Super Admins
CREATE OR REPLACE FUNCTION public.notify_super_admins(
  _kind text, _title text, _body text, _ref_type text, _ref_id uuid, _severity text DEFAULT 'info'
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH ins AS (
    INSERT INTO public.role_notifications(user_id, kind, title, body, ref_type, ref_id, severity)
    SELECT ur.user_id, _kind, _title, _body, _ref_type, _ref_id, _severity
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
     WHERE r.name = 'Super Admin'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END;
$$;

-- Trigger: new / reviewed requests notify SAs
CREATE OR REPLACE FUNCTION public.trg_notify_role_change_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sev text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_sev := CASE NEW.urgency WHEN 'critical' THEN 'critical' WHEN 'high' THEN 'warning' ELSE 'info' END;
    PERFORM public.notify_super_admins(
      'request_created',
      'Neuer Freigabeantrag: ' || COALESCE(NEW.role_name,'?'),
      NEW.reason, 'role_change_request', NEW.id, v_sev
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_super_admins(
        'request_approved',
        'Antrag freigegeben: ' || COALESCE(NEW.role_name,'?'),
        'Bereit zur Anwendung', 'role_change_request', NEW.id, 'info'
      );
    ELSIF NEW.status = 'applied' THEN
      PERFORM public.notify_super_admins(
        'request_applied',
        'Antrag angewendet: ' || COALESCE(NEW.role_name,'?'),
        NEW.action || ' erfolgt', 'role_change_request', NEW.id, 'info'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_role_change_request_notify ON public.role_change_requests;
CREATE TRIGGER trg_role_change_request_notify
  AFTER INSERT OR UPDATE ON public.role_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_role_change_request();

-- View: temp grants expiring within 24h (used by UI)
CREATE OR REPLACE VIEW public.v_temp_grants_expiring_soon AS
  SELECT g.*, EXTRACT(EPOCH FROM (g.valid_until - now()))/3600 AS hours_left
    FROM public.role_temporary_grants g
   WHERE g.status = 'active'
     AND g.valid_until > now()
     AND g.valid_until <= now() + interval '24 hours';
GRANT SELECT ON public.v_temp_grants_expiring_soon TO authenticated;

-- =========================================================
-- Phase 3.2: Rollen-Vorlagen (Onboarding-Pakete)
-- =========================================================
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  department_id uuid,
  position text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_templates TO authenticated;
GRANT ALL ON public.role_templates TO service_role;
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage templates" ON public.role_templates FOR ALL TO authenticated
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

CREATE TABLE public.role_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  role_id uuid NOT NULL,
  UNIQUE(template_id, role_id)
);
CREATE INDEX idx_role_template_items_tpl ON public.role_template_items(template_id);
GRANT SELECT, INSERT, DELETE ON public.role_template_items TO authenticated;
GRANT ALL ON public.role_template_items TO service_role;
ALTER TABLE public.role_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage template items" ON public.role_template_items FOR ALL TO authenticated
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

CREATE TRIGGER trg_role_templates_updated
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apply template (Onboarding)
CREATE OR REPLACE FUNCTION public.apply_role_template(_user_id uuid, _template_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_added int := 0; v_tpl text;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT name INTO v_tpl FROM public.role_templates WHERE id = _template_id;
  IF v_tpl IS NULL THEN RAISE EXCEPTION 'Vorlage nicht gefunden'; END IF;

  WITH ins AS (
    INSERT INTO public.user_roles(user_id, role_id)
    SELECT _user_id, ti.role_id
      FROM public.role_template_items ti
     WHERE ti.template_id = _template_id
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;

  INSERT INTO public.role_audit_log(actor_user_id, target_user_id, change_type, reason, new_value)
  VALUES (auth.uid(), _user_id, 'template_applied', 'Vorlage: '||v_tpl,
          jsonb_build_object('template_id', _template_id, 'roles_added', v_added));

  RETURN jsonb_build_object('ok', true, 'roles_added', v_added, 'template', v_tpl);
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_role_template(uuid, uuid) TO authenticated;

-- Offboarding: entzieht alle Rollen (Super Admin bleibt geschützt), läuft Zeit-Grants ab, setzt inaktiv
CREATE OR REPLACE FUNCTION public.offboard_user(_user_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_removed int; v_expired int;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Sie können sich nicht selbst offboarden';
  END IF;

  WITH del AS (
    DELETE FROM public.user_roles ur
    USING public.roles r
    WHERE r.id = ur.role_id AND ur.user_id = _user_id AND r.name <> 'Super Admin'
    RETURNING 1
  ) SELECT count(*) INTO v_removed FROM del;

  WITH upd AS (
    UPDATE public.role_temporary_grants
       SET status='revoked', auto_revoked_at=now()
     WHERE user_id=_user_id AND status='active'
    RETURNING 1
  ) SELECT count(*) INTO v_expired FROM upd;

  UPDATE public.user_profiles SET is_active = false WHERE id = _user_id;

  INSERT INTO public.role_audit_log(actor_user_id, target_user_id, change_type, reason, new_value)
  VALUES (auth.uid(), _user_id, 'offboarded', _reason,
          jsonb_build_object('roles_removed', v_removed, 'temp_grants_revoked', v_expired));

  RETURN jsonb_build_object('ok', true, 'roles_removed', v_removed, 'temp_grants_revoked', v_expired);
END;
$$;
GRANT EXECUTE ON FUNCTION public.offboard_user(uuid, text) TO authenticated;

-- =========================================================
-- Phase 3.3: Rezertifizierung (Access Review)
-- =========================================================
CREATE TABLE public.role_recert_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  period_start date NOT NULL DEFAULT CURRENT_DATE,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.role_recert_campaigns TO authenticated;
GRANT ALL ON public.role_recert_campaigns TO service_role;
ALTER TABLE public.role_recert_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA read campaigns" ON public.role_recert_campaigns FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));
CREATE POLICY "SA write campaigns" ON public.role_recert_campaigns FOR ALL TO authenticated
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

CREATE TABLE public.role_recert_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.role_recert_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  role_name text,
  decision text CHECK (decision IN ('confirm','revoke')),
  decided_by uuid,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id, role_id)
);
CREATE INDEX idx_recert_items_campaign ON public.role_recert_items(campaign_id, decision);
GRANT SELECT, INSERT, UPDATE ON public.role_recert_items TO authenticated;
GRANT ALL ON public.role_recert_items TO service_role;
ALTER TABLE public.role_recert_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage recert items" ON public.role_recert_items FOR ALL TO authenticated
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

-- Start campaign: 1 Prüfposition pro aktueller Rollenzuweisung
CREATE OR REPLACE FUNCTION public.start_recertification_campaign(
  _name text, _description text, _period_end date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_items int;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.role_recert_campaigns(name, description, period_end, created_by)
  VALUES (_name, _description, _period_end, auth.uid())
  RETURNING id INTO v_id;

  WITH ins AS (
    INSERT INTO public.role_recert_items(campaign_id, user_id, role_id, role_name)
    SELECT v_id, ur.user_id, ur.role_id, r.name
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
    RETURNING 1
  ) SELECT count(*) INTO v_items FROM ins;

  PERFORM public.notify_super_admins(
    'recert_started', 'Rezertifizierung gestartet: '||_name,
    v_items||' Prüfpositionen bis '||_period_end, 'role_recert_campaign', v_id, 'info'
  );
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_recertification_campaign(text, text, date) TO authenticated;

-- Decide item: confirm belässt Rolle, revoke entfernt sie
CREATE OR REPLACE FUNCTION public.decide_recert_item(
  _item_id uuid, _decision text, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.role_recert_items%ROWTYPE;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('confirm','revoke') THEN
    RAISE EXCEPTION 'Ungültige Entscheidung';
  END IF;
  SELECT * INTO it FROM public.role_recert_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Position nicht gefunden'; END IF;

  UPDATE public.role_recert_items
     SET decision = _decision, decided_by = auth.uid(), decided_at = now(), note = _note
   WHERE id = _item_id;

  IF _decision = 'revoke' THEN
    DELETE FROM public.user_roles WHERE user_id = it.user_id AND role_id = it.role_id;
    INSERT INTO public.role_audit_log(actor_user_id, target_user_id, role_id, role_name,
      change_type, reason, new_value)
    VALUES (auth.uid(), it.user_id, it.role_id, it.role_name, 'recert_revoked', _note,
            jsonb_build_object('campaign_id', it.campaign_id));
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decide_recert_item(uuid, text, text) TO authenticated;
