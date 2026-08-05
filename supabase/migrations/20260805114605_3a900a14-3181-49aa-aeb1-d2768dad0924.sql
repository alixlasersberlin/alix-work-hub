ALTER TABLE public.bank_return_debits
  ADD COLUMN IF NOT EXISTS dunning_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dunning_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_dunning_due date,
  ADD COLUMN IF NOT EXISTS dunning_paused boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bank_return_debits_dunning
  ON public.bank_return_debits (next_dunning_due, dunning_level)
  WHERE dunning_paused = false;