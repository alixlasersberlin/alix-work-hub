DO $approval$
DECLARE
  v_approver uuid := '587ff294-b34a-4c45-a8c0-a14a04ba3a8a';
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = v_approver AND r.name = 'Super Admin') THEN
    RAISE EXCEPTION 'Super-Admin-Freigabe nicht möglich';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_approver::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_approver::text, 'role', 'authenticated')::text, true);
  UPDATE public.catalog_items
  SET status = 'freigegeben', approved_at = now(), approved_by = v_approver
  WHERE id = 'ce00c8a5-1240-470b-b3e4-a3c2e62cb017'
    AND sku = 'Hollywood-Secret-250'
    AND approved_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Artikel wurde bereits freigegeben oder ist nicht eindeutig verfügbar';
  END IF;
END;
$approval$;