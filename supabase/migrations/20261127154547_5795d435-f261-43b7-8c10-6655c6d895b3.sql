-- Reproduce the reported failure without keeping an invoice.
DO $$
DECLARE v_blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.finance_deposits(source,source_ref,deposit_number,invoice_number,order_id,order_number,customer_id,gross_amount,currency)
    SELECT 'alixwork','order:'||o.id||':AZ-'||o.order_number||'-2','AZ-'||o.order_number||'-2','AZ-'||o.order_number||'-2',o.id,o.order_number,o.customer_id,5000,o.currency
    FROM public.orders o WHERE o.id='b6b5b28e-f284-4bc3-a6f0-453ecd1e33fc';
    RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='unexpected success';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Für diesen Auftrag gibt es bereits eine Anzahlung%' THEN RAISE; END IF;
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Original failure not reproduced'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finance_deposits_block_duplicate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_prefix text;
  v_is_split boolean := false;
  v_total numeric;
BEGIN
  IF NEW.status='storniert' OR NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.order_id,NEW.source,NEW.source_ref,NEW.invoice_number,NEW.deposit_number,NEW.customer_id,NEW.currency,NEW.gross_amount,NEW.status='storniert')
    IS NOT DISTINCT FROM ROW(OLD.order_id,OLD.source,OLD.source_ref,OLD.invoice_number,OLD.deposit_number,OLD.customer_id,OLD.currency,OLD.gross_amount,OLD.status='storniert') THEN
    RETURN NEW;
  END IF;
  -- Serialize all ordinary deposit inserts for this order; RLS remains unchanged.
  PERFORM pg_advisory_xact_lock(hashtextextended('finance-deposit:'||NEW.order_id::text,0));
  IF coalesce(NEW.deposit_number,'') LIKE 'AZ+%' THEN RETURN NEW; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=NEW.order_id;
  v_prefix := 'AZ-'||v_order.order_number||'-';
  IF NEW.source='alixwork' AND v_order.id IS NOT NULL
    AND left(NEW.invoice_number,length(v_prefix))=v_prefix
    AND substring(NEW.invoice_number FROM length(v_prefix)+1) ~ '^[1-9][0-9]*$' THEN
    v_is_split := true;
  END IF;
  IF v_is_split THEN
    IF NEW.source_ref IS DISTINCT FROM ('order:'||NEW.order_id||':'||NEW.invoice_number)
      OR NEW.deposit_number IS DISTINCT FROM NEW.invoice_number
      OR NEW.customer_id IS DISTINCT FROM v_order.customer_id
      OR NEW.currency IS DISTINCT FROM v_order.currency
      OR NEW.order_number IS DISTINCT FROM v_order.order_number THEN
      RAISE EXCEPTION 'Die Anzahlungsrate ist nicht eindeutig dem Auftrag zugeordnet.';
    END IF;
    IF NEW.gross_amount<=0 OR coalesce(v_order.deposit_amount,0)<=0 THEN
      RAISE EXCEPTION 'Für die Anzahlungsrate ist eine positive vereinbarte Anzahlung erforderlich.';
    END IF;
    IF EXISTS(SELECT 1 FROM public.finance_deposits d WHERE d.order_id=NEW.order_id AND d.id<>NEW.id
      AND d.status<>'storniert' AND lower(trim(d.invoice_number))=lower(trim(NEW.invoice_number))) THEN
      RAISE EXCEPTION 'Diese Anzahlungsrechnung ist bereits vorhanden.';
    END IF;
    SELECT coalesce(sum(d.gross_amount),0) INTO v_total FROM public.finance_deposits d
      WHERE d.order_id=NEW.order_id AND d.id<>NEW.id AND d.status<>'storniert'
      AND NOT (d.source='alixwork' AND d.source_ref='order:'||NEW.order_id AND nullif(trim(d.invoice_number),'') IS NULL);
    IF round(v_total+NEW.gross_amount,2)>round(v_order.deposit_amount,2) THEN
      RAISE EXCEPTION 'Die Summe der Anzahlungsraten überschreitet die vereinbarte Anzahlung (%).',v_order.deposit_amount;
    END IF;
    RETURN NEW;
  END IF;
  -- Preserve the original amount-based guard for non-installment deposits.
  IF EXISTS(SELECT 1 FROM public.finance_deposits d WHERE d.order_id=NEW.order_id AND d.id<>NEW.id
    AND d.status<>'storniert' AND d.gross_amount=NEW.gross_amount
    AND coalesce(d.deposit_number,'') NOT LIKE 'AZ+%') THEN
    RAISE EXCEPTION 'Für diesen Auftrag gibt es bereits eine Anzahlung über denselben Betrag.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_finance_deposits_block_duplicate ON public.finance_deposits;
CREATE TRIGGER trg_finance_deposits_block_duplicate BEFORE INSERT OR UPDATE OF order_id,order_number,source,source_ref,invoice_number,deposit_number,customer_id,currency,gross_amount,status ON public.finance_deposits
FOR EACH ROW EXECUTE FUNCTION public.finance_deposits_block_duplicate();

-- Regression tests: the subtransaction rolls back every test invoice.
DO $$
DECLARE o public.orders%ROWTYPE; v_id uuid; v_blocked boolean;
BEGIN
  SELECT * INTO STRICT o FROM public.orders WHERE id='b6b5b28e-f284-4bc3-a6f0-453ecd1e33fc';
  IF o.deposit_amount<>10000 THEN RAISE EXCEPTION 'Fixture deposit must be 10000'; END IF;
  BEGIN
    INSERT INTO public.finance_deposits(source,source_ref,deposit_number,invoice_number,order_id,order_number,customer_id,gross_amount,currency)
    VALUES('alixwork','order:'||o.id||':AZ-'||o.order_number||'-2','AZ-'||o.order_number||'-2','AZ-'||o.order_number||'-2',o.id,o.order_number,o.customer_id,5000,o.currency)
    RETURNING id INTO v_id;
    IF (SELECT sum(gross_amount) FROM public.finance_deposits WHERE order_id=o.id AND invoice_number IS NOT NULL AND status<>'storniert')<>10000 THEN
      RAISE EXCEPTION 'Expected two 5000 installments totaling 10000';
    END IF;
    v_blocked:=false;
    BEGIN
      INSERT INTO public.finance_deposits(source,source_ref,deposit_number,invoice_number,order_id,order_number,customer_id,gross_amount,currency)
      VALUES('alixwork','order:'||o.id||':AZ-'||o.order_number||'-3','AZ-'||o.order_number||'-3','AZ-'||o.order_number||'-3',o.id,o.order_number,o.customer_id,1,o.currency);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Die Summe der Anzahlungsraten%' THEN RAISE; END IF; v_blocked:=true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'Over-limit installment was accepted'; END IF;
    v_blocked:=false;
    BEGIN
      INSERT INTO public.finance_deposits(source,source_ref,deposit_number,invoice_number,order_id,order_number,customer_id,gross_amount,currency)
      VALUES('alixwork','order:'||o.id||':AZ-'||o.order_number||'-2','AZ-'||o.order_number||'-2','AZ-'||o.order_number||'-2',o.id,o.order_number,o.customer_id,5000,o.currency);
    EXCEPTION WHEN raise_exception OR unique_violation THEN v_blocked:=true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'Duplicate installment was accepted'; END IF;
    v_blocked:=false;
    BEGIN
      UPDATE public.finance_deposits SET gross_amount=5001 WHERE id=v_id;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Die Summe der Anzahlungsraten%' THEN RAISE; END IF; v_blocked:=true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'Over-limit update was accepted'; END IF;
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback successful regression tests';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END $$;