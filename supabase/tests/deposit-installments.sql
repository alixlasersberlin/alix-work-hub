-- Regression for AB-2026-04691: all temporary invoices roll back.
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