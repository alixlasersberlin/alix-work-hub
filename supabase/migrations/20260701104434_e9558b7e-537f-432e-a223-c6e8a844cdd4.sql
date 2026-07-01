
CREATE OR REPLACE FUNCTION public.trg_sales_leads_restrict_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_user IS DISTINCT FROM OLD.assigned_user THEN
    IF NOT public.has_role(auth.uid(), 'Super Admin') THEN
      RAISE EXCEPTION 'Nur Super Admin darf Leads zuweisen'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_leads_restrict_assign ON public.sales_leads;
CREATE TRIGGER sales_leads_restrict_assign
BEFORE UPDATE OF assigned_user ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_sales_leads_restrict_assign();
