CREATE OR REPLACE FUNCTION public.as_force_close_case(_case_id uuid, _reason text DEFAULT NULL)
RETURNS public.as_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_case public.as_cases;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Fälle ohne Bearbeitung schließen.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.as_checklist_items
     SET checked = true,
         checked_at = COALESCE(checked_at, now()),
         checked_by = COALESCE(checked_by, v_user),
         updated_at = now()
   WHERE case_id = _case_id
     AND checked = false;

  UPDATE public.as_callbacks
     SET done_at = now(),
         done_by = v_user
   WHERE case_id = _case_id
     AND done_at IS NULL;

  INSERT INTO public.as_mediapaket_status (case_id, stage, updated_by, updated_at)
  VALUES (_case_id, 'skipped'::public.as_mediapaket_stage, v_user, now())
  ON CONFLICT (case_id) DO UPDATE
    SET stage = CASE
                  WHEN public.as_mediapaket_status.stage IN ('done'::public.as_mediapaket_stage, 'skipped'::public.as_mediapaket_stage)
                    THEN public.as_mediapaket_status.stage
                  ELSE 'skipped'::public.as_mediapaket_stage
                END,
        updated_by = v_user,
        updated_at = now();

  UPDATE public.as_cases
     SET status = 'completed'::public.as_case_status,
         closed_at = now(),
         closed_by = v_user,
         progress_pct = 100,
         traffic_light = 'green'::public.as_traffic_light,
         updated_at = now()
   WHERE id = _case_id
  RETURNING * INTO v_case;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Fall nicht gefunden: %', _case_id;
  END IF;

  INSERT INTO public.as_timeline_events (case_id, event_type, title, body, source, created_by)
  VALUES (_case_id, 'case_force_closed',
          'Fall durch Super Admin ohne Bearbeitung abgeschlossen',
          _reason, 'user', v_user);

  RETURN v_case;
END;
$function$;

REVOKE ALL ON FUNCTION public.as_force_close_case(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.as_force_close_case(uuid, text) TO authenticated;