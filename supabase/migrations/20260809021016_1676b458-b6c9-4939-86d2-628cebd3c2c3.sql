CREATE TABLE IF NOT EXISTS public.recurring_prenotifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  zoho_recurring_invoice_id text,
  source_system text,
  customer_name text,
  email text not null,
  due_date date not null,
  amount numeric,
  currency text default 'EUR',
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recurring_prenotif ON public.recurring_prenotifications (coalesce(zoho_recurring_invoice_id, profile_id::text), due_date);
GRANT SELECT ON public.recurring_prenotifications TO authenticated;
GRANT ALL ON public.recurring_prenotifications TO service_role;
ALTER TABLE public.recurring_prenotifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prenotif_read_finance" ON public.recurring_prenotifications FOR SELECT TO authenticated USING (public.can_access_finance());