
-- 1) Spalten ergänzen
ALTER TABLE public.role_recert_items
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

ALTER TABLE public.role_recert_campaigns
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.role_recert_campaigns(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='role_recert_campaigns_recurrence_chk') THEN
    ALTER TABLE public.role_recert_campaigns
      ADD CONSTRAINT role_recert_campaigns_recurrence_chk
      CHECK (recurrence IN ('none','monthly','quarterly','yearly'));
  END IF;
END $$;

-- 2) RLS: Prüfer dürfen ihre eigenen Positionen lesen und aktualisieren
DROP POLICY IF EXISTS "Reviewer read own items" ON public.role_recert_items;
CREATE POLICY "Reviewer read own items" ON public.role_recert_items
  FOR SELECT USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Reviewer update own items" ON public.role_recert_items;
CREATE POLICY "Reviewer update own items" ON public.role_recert_items
  FOR UPDATE USING (reviewer_id = auth.uid()) WITH CHECK (reviewer_id = auth.uid());

-- 3) decide_recert_item: Prüfer darf entscheiden
CREATE OR REPLACE FUNCTION public.decide_recert_item(_item_id uuid, _decision text, _note text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE it public.role_recert_items%ROWTYPE;
BEGIN
  SELECT * INTO it FROM public.role_recert_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Position nicht gefunden'; END IF;
  IF NOT (public.has_role('Super Admin') OR it.reviewer_id = auth.uid()) THEN
    RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('confirm','revoke') THEN
    RAISE EXCEPTION 'Ungültige Entscheidung';
  END IF;
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
END; $$;

-- 4) Delegation
CREATE OR REPLACE FUNCTION public.delegate_recert_item(_item_id uuid, _reviewer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE camp text;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.role_recert_items SET reviewer_id = _reviewer_id WHERE id = _item_id;
  SELECT c.name INTO camp
    FROM public.role_recert_items i
    JOIN public.role_recert_campaigns c ON c.id = i.campaign_id
   WHERE i.id = _item_id;
  INSERT INTO public.role_notifications(user_id, kind, title, body, ref_type, ref_id, severity)
  VALUES (_reviewer_id, 'recert_delegate', 'Rezertifizierung zugewiesen',
          'Sie wurden als Prüfer für eine Rollenzuweisung in Kampagne "' || COALESCE(camp,'') || '" eingeteilt.',
          'recert_item', _item_id, 'info');
  RETURN jsonb_build_object('ok', true);
END; $$;

-- 5) Erinnerungen
CREATE OR REPLACE FUNCTION public.send_recert_reminders(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cnt integer := 0; camp text; sa_role uuid;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT name INTO camp FROM public.role_recert_campaigns WHERE id = _campaign_id;
  SELECT id INTO sa_role FROM public.roles WHERE name = 'Super Admin' LIMIT 1;

  -- an delegierte Prüfer
  INSERT INTO public.role_notifications(user_id, kind, title, body, ref_type, ref_id, severity)
  SELECT i.reviewer_id, 'recert_reminder', 'Rezertifizierung offen',
         'Kampagne "' || COALESCE(camp,'') || '": Ihre offenen Rollenprüfungen stehen an.',
         'recert_item', i.id, 'warn'
    FROM public.role_recert_items i
   WHERE i.campaign_id = _campaign_id AND i.decision IS NULL AND i.reviewer_id IS NOT NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT;

  -- nicht delegierte Positionen an alle Super Admins
  IF sa_role IS NOT NULL THEN
    INSERT INTO public.role_notifications(user_id, kind, title, body, ref_type, ref_id, severity)
    SELECT ur.user_id, 'recert_reminder', 'Rezertifizierung offen',
           'Kampagne "' || COALESCE(camp,'') || '": ' ||
           (SELECT count(*) FROM public.role_recert_items WHERE campaign_id=_campaign_id AND decision IS NULL AND reviewer_id IS NULL) ||
           ' nicht delegierte Positionen prüfen.',
           'recert_campaign', _campaign_id, 'warn'
      FROM public.user_roles ur
     WHERE ur.role_id = sa_role
       AND EXISTS (SELECT 1 FROM public.role_recert_items WHERE campaign_id=_campaign_id AND decision IS NULL AND reviewer_id IS NULL);
  END IF;

  UPDATE public.role_recert_items
     SET reminded_at = now()
   WHERE campaign_id = _campaign_id AND decision IS NULL;

  RETURN jsonb_build_object('ok', true, 'sent', cnt);
END; $$;

-- 6) Auto-Folgekampagne bei Abschluss
CREATE OR REPLACE FUNCTION public.recert_auto_next()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE new_end date; new_id uuid; days integer;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.recurrence <> 'none' THEN
    days := CASE NEW.recurrence
              WHEN 'monthly' THEN 30
              WHEN 'quarterly' THEN 90
              WHEN 'yearly' THEN 365
            END;
    new_end := (CURRENT_DATE + days);
    INSERT INTO public.role_recert_campaigns
      (name, description, period_end, recurrence, reminder_days_before, parent_campaign_id, created_by)
    VALUES
      (NEW.name || ' (Folgekampagne)', NEW.description, new_end,
       NEW.recurrence, NEW.reminder_days_before, NEW.id, NEW.created_by)
    RETURNING id INTO new_id;

    INSERT INTO public.role_recert_items(campaign_id, user_id, role_id, role_name)
    SELECT new_id, ur.user_id, ur.role_id, r.name
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_recert_auto_next ON public.role_recert_campaigns;
CREATE TRIGGER trg_recert_auto_next
  AFTER UPDATE ON public.role_recert_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.recert_auto_next();
