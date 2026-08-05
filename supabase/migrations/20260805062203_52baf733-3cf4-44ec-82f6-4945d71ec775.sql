ALTER TABLE public.cmr_settings ADD COLUMN IF NOT EXISTS dunning_auto_send boolean NOT NULL DEFAULT false;
ALTER TABLE public.cmr_payments ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.cmr_sync_paid_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid := COALESCE(NEW.document_id, OLD.document_id);
BEGIN
  IF v_doc IS NOT NULL THEN
    UPDATE public.cmr_documents d
       SET paid_total = COALESCE((
             SELECT SUM(COALESCE(p.amount,0) + COALESCE(p.discount_amount,0))
             FROM public.cmr_payments p WHERE p.document_id = v_doc), 0),
           updated_at = now()
     WHERE d.id = v_doc;
  END IF;
  RETURN NULL;
END $function$;