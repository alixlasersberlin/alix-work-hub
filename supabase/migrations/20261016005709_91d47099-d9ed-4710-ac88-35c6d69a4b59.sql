UPDATE public.finance_deposits SET status='storniert',
 note=coalesce(note||E'\n','')||'Storniert 16.10.2026: Doppelte Anzahlung (Bereinigung)', updated_at=now()
WHERE id IN ('016d42ae-eb11-40de-a3a7-c57a9c5c7ce1','a5bdd6cf-28fa-47b0-9c83-ae337c9ac6aa','4d6e0974-1622-4303-8fd6-9c28e91328e4','b4d157d9-9d7e-4a23-8321-dc398eb6152c','8d00410e-b1e2-4ba2-9177-b336fc5d9011','e29df3c4-8ac6-4b01-b17b-b539b4d1851b');

CREATE OR REPLACE FUNCTION public.finance_deposits_block_duplicate()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('storniert') OR NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.deposit_number,'') LIKE 'AZ+%' THEN RETURN NEW; END IF; -- Zusatz-Anzahlung erlaubt
  IF EXISTS (SELECT 1 FROM public.finance_deposits d
     WHERE d.order_id=NEW.order_id AND d.id<>NEW.id
       AND d.status<>'storniert'
       AND d.gross_amount=NEW.gross_amount
       AND coalesce(d.deposit_number,'') NOT LIKE 'AZ+%') THEN
    RAISE EXCEPTION 'Für diesen Auftrag gibt es bereits eine Anzahlung über denselben Betrag.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_finance_deposits_block_duplicate ON public.finance_deposits;
CREATE TRIGGER trg_finance_deposits_block_duplicate BEFORE INSERT ON public.finance_deposits
FOR EACH ROW EXECUTE FUNCTION public.finance_deposits_block_duplicate();