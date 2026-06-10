-- Phase 2: dedup index for Zoho-Sync into finance_transactions
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_tx_reference
  ON public.finance_transactions(reference)
  WHERE reference IS NOT NULL;