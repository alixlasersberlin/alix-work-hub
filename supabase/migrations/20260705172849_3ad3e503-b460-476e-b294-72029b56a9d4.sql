CREATE OR REPLACE FUNCTION public.trg_sales_leads_restrict_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_user IS DISTINCT FROM OLD.assigned_user THEN
    IF NOT public.has_role('Super Admin') THEN
      RAISE EXCEPTION 'Nur Super Admin darf Leads zuweisen'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;