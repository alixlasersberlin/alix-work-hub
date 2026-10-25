CREATE OR REPLACE FUNCTION public.catalog_track_edit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.approved_by IS NOT NULL AND (OLD.approved_by IS NULL OR OLD.approved_by <> NEW.approved_by) THEN
      IF NEW.approved_by = COALESCE(NEW.last_edited_by, OLD.last_edited_by)
         AND NOT public.has_role('Super Admin') THEN
        RAISE EXCEPTION 'Vier-Augen-Prinzip: Freigeber darf nicht letzter Bearbeiter sein';
      END IF;
      NEW.approved_at := now();
    ELSE
      NEW.last_edited_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.last_edited_by := COALESCE(NEW.last_edited_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.catalog_price_four_eyes_check()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approved_by IS NOT NULL AND NEW.reviewed_by IS NOT NULL
     AND NEW.approved_by = NEW.reviewed_by
     AND NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION '4-Augen-Prinzip verletzt: Freigeber muss von Prüfer verschieden sein';
  END IF;
  RETURN NEW;
END $function$;