ALTER TABLE public.bank_financing_requests
  ADD COLUMN IF NOT EXISTS in_processing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_processing_date date,
  ADD COLUMN IF NOT EXISTS in_processing_note text;