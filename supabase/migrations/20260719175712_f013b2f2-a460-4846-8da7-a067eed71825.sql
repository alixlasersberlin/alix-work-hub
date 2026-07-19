CREATE OR REPLACE FUNCTION public.alixdocs_set_default_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expiry_date IS NULL THEN
    NEW.expiry_date := (COALESCE(NEW.created_at, now())::date + INTERVAL '7 years')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alixdocs_default_expiry ON public.alixdocs_documents;
CREATE TRIGGER trg_alixdocs_default_expiry
BEFORE INSERT ON public.alixdocs_documents
FOR EACH ROW
EXECUTE FUNCTION public.alixdocs_set_default_expiry();