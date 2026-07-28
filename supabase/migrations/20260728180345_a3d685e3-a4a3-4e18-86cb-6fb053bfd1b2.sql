ALTER TABLE public.finance_deposits DROP CONSTRAINT IF EXISTS finance_deposits_status_check;
ALTER TABLE public.finance_deposits ADD CONSTRAINT finance_deposits_status_check
  CHECK (status = ANY (ARRAY['entwurf'::text, 'offen'::text, 'ueberfaellig'::text, 'teilweise'::text, 'gebucht'::text, 'bezahlt'::text]));