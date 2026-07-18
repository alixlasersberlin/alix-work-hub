-- =================================================================
-- AlixSmart Outbound: Trigger für Orders, Device-Links, Customer-Links
-- =================================================================

-- 1) orders → order.updated
CREATE OR REPLACE FUNCTION public.trg_alixsmart_order_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Echo-Schutz: Bestellungen aus AlixSmart nicht zurücksenden
  IF NEW.source_system = 'alixsmart' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT (
       (OLD.order_status IS DISTINCT FROM NEW.order_status)
    OR (OLD.finance_payment_status IS DISTINCT FROM NEW.finance_payment_status)
    OR (OLD.deposit_ok IS DISTINCT FROM NEW.deposit_ok)
    OR (OLD.signature_status IS DISTINCT FROM NEW.signature_status)
    OR (OLD.expected_shipment_date IS DISTINCT FROM NEW.expected_shipment_date)
  ) THEN
    RETURN NEW;
  END IF;
  PERFORM public.alixsmart_emit('order.updated', jsonb_build_object(
    'local_order_id',   NEW.order_number,
    'external_order_id',NEW.external_order_id,
    'order_number',     NEW.order_number,
    'status',           NEW.order_status,
    'payment_status',   NEW.finance_payment_status,
    'deposit_ok',       NEW.deposit_ok,
    'signature_status', NEW.signature_status,
    'total_amount',     NEW.total_amount,
    'currency',         NEW.currency,
    'shipment_date',    NEW.expected_shipment_date,
    'updated_at',       NEW.updated_at
  ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alixsmart_order_updated ON public.orders;
CREATE TRIGGER trg_alixsmart_order_updated
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_alixsmart_order_updated();

-- 2) alixsmart_device_links → device.updated
CREATE OR REPLACE FUNCTION public.trg_alixsmart_device_link_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (
       (OLD.registration_status IS DISTINCT FROM NEW.registration_status)
    OR (OLD.registered_at IS DISTINCT FROM NEW.registered_at)
    OR (OLD.alixsmart_device_id IS DISTINCT FROM NEW.alixsmart_device_id)
  ) THEN
    RETURN NEW;
  END IF;
  PERFORM public.alixsmart_emit('device.updated', jsonb_build_object(
    'alixwork_customer_id', NEW.alixwork_customer_id,
    'serial_number',        NEW.serial_number,
    'registration_status',  NEW.registration_status,
    'registered_at',        NEW.registered_at,
    'alixsmart_device_id',  NEW.alixsmart_device_id,
    'updated_at',           NEW.updated_at
  ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alixsmart_device_link_updated ON public.alixsmart_device_links;
CREATE TRIGGER trg_alixsmart_device_link_updated
  AFTER INSERT OR UPDATE ON public.alixsmart_device_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_alixsmart_device_link_updated();

-- 3) alixsmart_customer_links → registration.created (nur INSERT ohne alixsmart_user_id = neue lokale Anmeldung)
CREATE OR REPLACE FUNCTION public.trg_alixsmart_customer_link_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.alixsmart_emit('registration.created', jsonb_build_object(
    'alixwork_customer_id', NEW.alixwork_customer_id,
    'alixsmart_user_id',    NEW.alixsmart_user_id,
    'match_status',         NEW.match_status,
    'match_score',          NEW.match_score,
    'manually_confirmed',   NEW.manually_confirmed,
    'created_at',           NEW.created_at
  ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alixsmart_customer_link_created ON public.alixsmart_customer_links;
CREATE TRIGGER trg_alixsmart_customer_link_created
  AFTER INSERT ON public.alixsmart_customer_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_alixsmart_customer_link_created();