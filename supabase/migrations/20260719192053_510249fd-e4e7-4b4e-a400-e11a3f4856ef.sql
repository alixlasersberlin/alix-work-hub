CREATE OR REPLACE FUNCTION public.alixdocs_set_default_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expiry_date := (COALESCE(NEW.created_at, now())::date + INTERVAL '7 years')::date;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_alixdocs_default_expiry ON public.alixdocs_documents;

CREATE TRIGGER trg_alixdocs_default_expiry
BEFORE INSERT OR UPDATE ON public.alixdocs_documents
FOR EACH ROW
EXECUTE FUNCTION public.alixdocs_set_default_expiry();