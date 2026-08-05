DROP POLICY IF EXISTS bank_tx_delete ON public.bank_transactions;
CREATE POLICY bank_tx_delete ON public.bank_transactions FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

DROP POLICY IF EXISTS bank_alloc_delete ON public.bank_transaction_allocations;
CREATE POLICY bank_alloc_delete ON public.bank_transaction_allocations FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

DROP POLICY IF EXISTS bank_rd_delete ON public.bank_return_debits;
CREATE POLICY bank_rd_delete ON public.bank_return_debits FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

DROP POLICY IF EXISTS bank_rd_alloc_delete ON public.bank_return_debit_allocations;
CREATE POLICY bank_rd_alloc_delete ON public.bank_return_debit_allocations FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

GRANT DELETE ON public.bank_transactions, public.bank_transaction_allocations,
  public.bank_transaction_matches, public.bank_return_debits,
  public.bank_return_debit_allocations, public.bank_imports TO authenticated;