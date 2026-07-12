
-- ============================================================
-- 1) ATTACHMENT-HÄRTUNG
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_ticket_attachment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext text;
  v_mime text;
  v_size bigint;
  v_blocked_ext text[] := ARRAY[
    'exe','bat','cmd','com','scr','pif','msi','vbs','vbe','js','jse',
    'wsf','wsh','ps1','ps1xml','psm1','jar','app','sh','bash','zsh',
    'apk','ipa','dll','sys','reg','hta','htm','html','svg','xhtml',
    'phtml','php','php3','php4','php5','asp','aspx','jsp','cgi'
  ];
  v_blocked_mime text[] := ARRAY[
    'text/html','application/xhtml+xml','image/svg+xml',
    'application/x-msdownload','application/x-msdos-program',
    'application/x-executable','application/x-mach-binary',
    'application/vnd.microsoft.portable-executable',
    'application/javascript','application/x-javascript','text/javascript',
    'application/x-httpd-php','application/x-sh'
  ];
BEGIN
  v_size := COALESCE(NEW.file_size, 0);
  IF v_size > 25 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Datei ist zu groß (max. 25 MB): %', NEW.file_name;
  END IF;

  v_ext := lower(regexp_replace(COALESCE(NEW.file_name, ''), '^.*\.([^.]+)$', '\1'));
  IF v_ext = ANY(v_blocked_ext) THEN
    RAISE EXCEPTION 'Dateityp .% ist aus Sicherheitsgründen nicht erlaubt', v_ext;
  END IF;

  v_mime := lower(COALESCE(NEW.file_type, ''));
  IF v_mime = ANY(v_blocked_mime) THEN
    RAISE EXCEPTION 'MIME-Typ "%" ist aus Sicherheitsgründen nicht erlaubt', v_mime;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ticket_attachment ON public.ticket_attachments;
CREATE TRIGGER trg_validate_ticket_attachment
BEFORE INSERT OR UPDATE ON public.ticket_attachments
FOR EACH ROW
EXECUTE FUNCTION public.validate_ticket_attachment();

-- ============================================================
-- 2) AUTO-CLOSE STALE TICKETS
-- ============================================================
CREATE OR REPLACE FUNCTION public.ticket_auto_close_stale()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unreachable_closed int := 0;
  v_solved_archived int := 0;
  v_rec record;
BEGIN
  -- (a) customer_unreachable > 14 Tage → schließen
  FOR v_rec IN
    SELECT id FROM public.tickets
    WHERE comm_status = 'customer_unreachable'
      AND COALESCE(comm_status_since, updated_at, created_at) < now() - interval '14 days'
      AND status NOT IN ('geschlossen','gelöst','closed')
    LIMIT 500
  LOOP
    UPDATE public.tickets
    SET status = 'geschlossen',
        comm_status = NULL,
        updated_at = now()
    WHERE id = v_rec.id;

    INSERT INTO public.ticket_history(ticket_id, action, field, new_value, actor_name)
    VALUES (v_rec.id, 'auto_closed', 'status', 'geschlossen (Kunde nicht erreichbar)', 'System');

    v_unreachable_closed := v_unreachable_closed + 1;
  END LOOP;

  -- (b) gelöste Tickets > 90 Tage → archivieren (geschlossen)
  FOR v_rec IN
    SELECT id FROM public.tickets
    WHERE status = 'gelöst'
      AND updated_at < now() - interval '90 days'
    LIMIT 500
  LOOP
    UPDATE public.tickets
    SET status = 'geschlossen', updated_at = now()
    WHERE id = v_rec.id;

    INSERT INTO public.ticket_history(ticket_id, action, field, new_value, actor_name)
    VALUES (v_rec.id, 'auto_archived', 'status', 'geschlossen (Auto-Archiv nach 90 Tagen)', 'System');

    v_solved_archived := v_solved_archived + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'unreachable_closed', v_unreachable_closed,
    'solved_archived', v_solved_archived,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_auto_close_stale() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ticket_auto_close_stale() TO service_role;
