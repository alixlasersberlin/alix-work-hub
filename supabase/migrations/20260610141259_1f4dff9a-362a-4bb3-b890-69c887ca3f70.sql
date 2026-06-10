
-- ============ Helper Function ============
CREATE OR REPLACE FUNCTION public.can_access_finance_module()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_role('Finance')
      OR public.has_role('Geschäftsführung');
$$;

CREATE OR REPLACE FUNCTION public.can_view_finance_module()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_access_finance_module()
      OR public.has_role('Kundenservice')
      OR public.has_role('Serviceleitung');
$$;

-- ============ finance_accounts ============
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  debtor_number text,
  payment_terms text,
  credit_limit numeric(14,2) DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  overdue_balance numeric(14,2) NOT NULL DEFAULT 0,
  reminder_level int NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  last_payment_at timestamptz,
  last_reminder_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO authenticated;
GRANT ALL ON public.finance_accounts TO service_role;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_accounts_select" ON public.finance_accounts;
CREATE POLICY "finance_accounts_select" ON public.finance_accounts FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "finance_accounts_insert" ON public.finance_accounts;
CREATE POLICY "finance_accounts_insert" ON public.finance_accounts FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_accounts_update" ON public.finance_accounts;
CREATE POLICY "finance_accounts_update" ON public.finance_accounts FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_accounts_delete" ON public.finance_accounts;
CREATE POLICY "finance_accounts_delete" ON public.finance_accounts FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_finance_accounts_updated_at ON public.finance_accounts;
CREATE TRIGGER trg_finance_accounts_updated_at BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ finance_contracts ============
CREATE TABLE IF NOT EXISTS public.finance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.lager_devices(id) ON DELETE SET NULL,
  contract_number text UNIQUE,
  contract_type text NOT NULL DEFAULT 'Kauf',
  start_date date,
  end_date date,
  monthly_rate numeric(14,2),
  remaining_amount numeric(14,2),
  status text NOT NULL DEFAULT 'entwurf',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_contracts_customer ON public.finance_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_contracts_order ON public.finance_contracts(order_id);
CREATE INDEX IF NOT EXISTS idx_finance_contracts_device ON public.finance_contracts(device_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_contracts TO authenticated;
GRANT ALL ON public.finance_contracts TO service_role;
ALTER TABLE public.finance_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_contracts_select" ON public.finance_contracts;
CREATE POLICY "finance_contracts_select" ON public.finance_contracts FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "finance_contracts_insert" ON public.finance_contracts;
CREATE POLICY "finance_contracts_insert" ON public.finance_contracts FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_contracts_update" ON public.finance_contracts;
CREATE POLICY "finance_contracts_update" ON public.finance_contracts FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_contracts_delete" ON public.finance_contracts;
CREATE POLICY "finance_contracts_delete" ON public.finance_contracts FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_finance_contracts_updated_at ON public.finance_contracts;
CREATE TRIGGER trg_finance_contracts_updated_at BEFORE UPDATE ON public.finance_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ finance_transactions ============
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.lager_devices(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.finance_contracts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  booking_date date NOT NULL DEFAULT current_date,
  reference text,
  transaction_type text NOT NULL DEFAULT 'Sonstiges',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_tx_customer ON public.finance_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_order ON public.finance_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_contract ON public.finance_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_type ON public.finance_transactions(transaction_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_tx_select" ON public.finance_transactions;
CREATE POLICY "finance_tx_select" ON public.finance_transactions FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "finance_tx_insert" ON public.finance_transactions;
CREATE POLICY "finance_tx_insert" ON public.finance_transactions FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_tx_update" ON public.finance_transactions;
CREATE POLICY "finance_tx_update" ON public.finance_transactions FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "finance_tx_delete" ON public.finance_transactions;
CREATE POLICY "finance_tx_delete" ON public.finance_transactions FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ finance_history (append-only) ============
CREATE TABLE IF NOT EXISTS public.finance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  user_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_history_table_record ON public.finance_history(table_name, record_id);
GRANT SELECT ON public.finance_history TO authenticated;
GRANT ALL ON public.finance_history TO service_role;
ALTER TABLE public.finance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_history_select" ON public.finance_history;
CREATE POLICY "finance_history_select" ON public.finance_history FOR SELECT TO authenticated USING (public.can_access_finance_module());
-- Kein INSERT/UPDATE/DELETE aus der App: nur Trigger (SECURITY DEFINER) schreibt.

CREATE OR REPLACE FUNCTION public.finance_history_trg_fn()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW); v_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_id := NEW.id;
  ELSE
    v_old := to_jsonb(OLD); v_id := OLD.id;
  END IF;
  BEGIN
    INSERT INTO public.finance_history(table_name, record_id, user_id, action, old_value, new_value)
    VALUES (TG_TABLE_NAME, v_id, auth.uid(), TG_OP, v_old, v_new);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_finance_history_accounts ON public.finance_accounts;
CREATE TRIGGER trg_finance_history_accounts AFTER INSERT OR UPDATE OR DELETE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.finance_history_trg_fn();
DROP TRIGGER IF EXISTS trg_finance_history_contracts ON public.finance_contracts;
CREATE TRIGGER trg_finance_history_contracts AFTER INSERT OR UPDATE OR DELETE ON public.finance_contracts
  FOR EACH ROW EXECUTE FUNCTION public.finance_history_trg_fn();
DROP TRIGGER IF EXISTS trg_finance_history_transactions ON public.finance_transactions;
CREATE TRIGGER trg_finance_history_transactions AFTER INSERT OR UPDATE OR DELETE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_history_trg_fn();

-- Audit-Logs aus bestehender Infrastruktur
DROP TRIGGER IF EXISTS trg_audit_finance_accounts ON public.finance_accounts;
CREATE TRIGGER trg_audit_finance_accounts AFTER INSERT OR UPDATE OR DELETE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
DROP TRIGGER IF EXISTS trg_audit_finance_contracts ON public.finance_contracts;
CREATE TRIGGER trg_audit_finance_contracts AFTER INSERT OR UPDATE OR DELETE ON public.finance_contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
DROP TRIGGER IF EXISTS trg_audit_finance_transactions ON public.finance_transactions;
CREATE TRIGGER trg_audit_finance_transactions AFTER INSERT OR UPDATE OR DELETE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ============ Additive Spalten: orders ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS finance_total_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS finance_deposit_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS finance_remaining_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS finance_open_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS finance_paid_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS finance_overdue_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS finance_payment_status text;

-- ============ Additive Spalten: lager_devices ============
ALTER TABLE public.lager_devices
  ADD COLUMN IF NOT EXISTS finance_contract_number text,
  ADD COLUMN IF NOT EXISTS finance_status text,
  ADD COLUMN IF NOT EXISTS finance_invoice_status text,
  ADD COLUMN IF NOT EXISTS finance_payment_status text,
  ADD COLUMN IF NOT EXISTS finance_block_status text,
  ADD COLUMN IF NOT EXISTS finance_open_amount numeric(14,2);
