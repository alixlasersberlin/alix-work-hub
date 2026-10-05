CREATE OR REPLACE FUNCTION public.alix_sign_sync_offer_payload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.payload IS NULL OR NEW.payload IS NOT DISTINCT FROM OLD.payload THEN RETURN NEW; END IF;
  FOR r IN SELECT id FROM alix_sign_requests
    WHERE offer_number = NEW.offer_number AND signed_at IS NULL
      AND status NOT IN ('signiert','abgelehnt','abgelaufen','storniert')
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    UPDATE alix_sign_requests SET offer_payload = coalesce(offer_payload,'{}'::jsonb) || NEW.payload, updated_at = now() WHERE id = r.id;
    INSERT INTO alix_sign_audit_log(sign_request_id, action, details)
      VALUES (r.id, 'offer_payload_synced', jsonb_build_object('offer_id', NEW.id, 'by', auth.uid(), 'totals', NEW.payload->'totals', 'payment', NEW.payload->'payment'));
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.alix_sign_sync_offer_payload() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_alix_sign_sync_offer_payload ON public.offers;
CREATE TRIGGER trg_alix_sign_sync_offer_payload AFTER UPDATE OF payload ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.alix_sign_sync_offer_payload();