CREATE OR REPLACE FUNCTION public.finance_inherit_accounting_region()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_region public.accounting_region;
  v_order text;
  v_customer text;
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.accounting_region IS NULL OR NEW.accounting_region = 'EU') THEN
    IF to_jsonb(NEW) ? 'order_id' THEN
      v_order := to_jsonb(NEW)->>'order_id';
    END IF;
    IF to_jsonb(NEW) ? 'customer_id' THEN
      v_customer := to_jsonb(NEW)->>'customer_id';
    END IF;

    IF v_order IS NOT NULL AND v_order ~ c_uuid THEN
      SELECT o.accounting_region INTO v_region
      FROM public.orders o WHERE o.id = v_order::uuid;
    END IF;

    IF v_region IS NULL AND v_customer IS NOT NULL AND v_customer ~ c_uuid THEN
      SELECT c.accounting_region INTO v_region
      FROM public.customers c WHERE c.id = v_customer::uuid;
    END IF;

    IF v_region IS NOT NULL THEN
      NEW.accounting_region := v_region;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;