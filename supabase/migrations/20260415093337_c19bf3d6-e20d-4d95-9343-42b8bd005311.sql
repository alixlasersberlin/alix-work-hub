
ALTER TABLE public.customers
  ADD COLUMN iban text,
  ADD COLUMN bic text,
  ADD COLUMN bank_name text;
