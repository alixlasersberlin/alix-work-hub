ALTER TABLE public.bank_financing_requests
  ADD CONSTRAINT bank_financing_requests_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bank_financing_requests_order_id ON public.bank_financing_requests(order_id);

NOTIFY pgrst, 'reload schema';