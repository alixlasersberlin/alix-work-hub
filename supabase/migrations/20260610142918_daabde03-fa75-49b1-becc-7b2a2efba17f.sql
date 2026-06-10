
-- ============ finance_reminders ============
CREATE TABLE IF NOT EXISTS public.finance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  fee numeric(14,2) NOT NULL DEFAULT 0,
  interest numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'Entwurf',
  sent_at timestamptz,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_message_id text,
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_reminders_customer ON public.finance_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_reminders_status ON public.finance_reminders(status);
CREATE INDEX IF NOT EXISTS idx_finance_reminders_level ON public.finance_reminders(level);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_reminders TO authenticated;
GRANT ALL ON public.finance_reminders TO service_role;
ALTER TABLE public.finance_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_reminders_select" ON public.finance_reminders;
CREATE POLICY "finance_reminders_select" ON public.finance_reminders FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "finance_reminders_insert" ON public.finance_reminders;
CREATE POLICY "finance_reminders_insert" ON public.finance_reminders FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_reminders_update" ON public.finance_reminders;
CREATE POLICY "finance_reminders_update" ON public.finance_reminders FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_reminders_delete" ON public.finance_reminders;
CREATE POLICY "finance_reminders_delete" ON public.finance_reminders FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_finance_reminders_updated_at ON public.finance_reminders;
CREATE TRIGGER trg_finance_reminders_updated_at BEFORE UPDATE ON public.finance_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ finance_reminder_items ============
CREATE TABLE IF NOT EXISTS public.finance_reminder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.finance_reminders(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.finance_transactions(id) ON DELETE SET NULL,
  invoice_number text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  due_date date,
  days_overdue integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_reminder_items_reminder ON public.finance_reminder_items(reminder_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_reminder_items TO authenticated;
GRANT ALL ON public.finance_reminder_items TO service_role;
ALTER TABLE public.finance_reminder_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_reminder_items_select" ON public.finance_reminder_items;
CREATE POLICY "finance_reminder_items_select" ON public.finance_reminder_items FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "finance_reminder_items_insert" ON public.finance_reminder_items;
CREATE POLICY "finance_reminder_items_insert" ON public.finance_reminder_items FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_reminder_items_update" ON public.finance_reminder_items;
CREATE POLICY "finance_reminder_items_update" ON public.finance_reminder_items FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_reminder_items_delete" ON public.finance_reminder_items;
CREATE POLICY "finance_reminder_items_delete" ON public.finance_reminder_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
