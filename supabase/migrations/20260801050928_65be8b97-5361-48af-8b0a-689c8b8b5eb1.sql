CREATE TABLE public.device_lock_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_type text NOT NULL DEFAULT 'csv',
  row_count integer NOT NULL DEFAULT 0,
  raw_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_lock_imports TO authenticated;
GRANT ALL ON public.device_lock_imports TO service_role;
ALTER TABLE public.device_lock_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dli_read" ON public.device_lock_imports FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance());
CREATE POLICY "dli_insert" ON public.device_lock_imports FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance());
CREATE POLICY "dli_update" ON public.device_lock_imports FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance())
  WITH CHECK (public.is_admin() OR public.can_access_finance());
CREATE POLICY "dli_delete" ON public.device_lock_imports FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.device_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.zoho_invoices(id) ON DELETE SET NULL,
  invoice_number text,
  customer_id uuid,
  customer_name text,
  amount numeric,
  currency text DEFAULT 'EUR',
  return_date date,
  return_reason text,
  lock_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'vorschlag',
  source text NOT NULL DEFAULT 'rueck_import',
  import_id uuid REFERENCES public.device_lock_imports(id) ON DELETE SET NULL,
  activated_at timestamptz,
  activated_by uuid,
  released_at timestamptz,
  released_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_locks_status ON public.device_locks(status);
CREATE INDEX idx_device_locks_invoice ON public.device_locks(invoice_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_locks TO authenticated;
GRANT ALL ON public.device_locks TO service_role;
ALTER TABLE public.device_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dl_read" ON public.device_locks FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance());
CREATE POLICY "dl_insert" ON public.device_locks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance());
CREATE POLICY "dl_update" ON public.device_locks FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance())
  WITH CHECK (public.is_admin() OR public.can_access_finance());
CREATE POLICY "dl_delete" ON public.device_locks FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_device_locks_updated BEFORE UPDATE ON public.device_locks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_device_lock_imports_updated BEFORE UPDATE ON public.device_lock_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();