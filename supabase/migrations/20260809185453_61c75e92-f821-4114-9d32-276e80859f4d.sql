ALTER TABLE public.mail_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

CREATE INDEX IF NOT EXISTS idx_mail_messages_tenant_id ON public.mail_messages(tenant_id);

UPDATE public.mail_messages m
SET tenant_id = t.id
FROM public.orders o
JOIN public.tenants t ON t.code = public.source_to_tenant_code(o.source_system)
WHERE m.tenant_id IS NULL AND m.order_id = o.id;

UPDATE public.mail_messages m
SET tenant_id = t.id
FROM public.customers c
JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE m.tenant_id IS NULL AND m.customer_id = c.id;

CREATE OR REPLACE FUNCTION public.mail_messages_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT t.id INTO NEW.tenant_id
      FROM public.orders o
      JOIN public.tenants t ON t.code = public.source_to_tenant_code(o.source_system)
     WHERE o.id = NEW.order_id;
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT t.id INTO NEW.tenant_id
      FROM public.customers c
      JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
     WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mail_messages_set_tenant ON public.mail_messages;
CREATE TRIGGER trg_mail_messages_set_tenant
BEFORE INSERT OR UPDATE OF order_id, customer_id ON public.mail_messages
FOR EACH ROW EXECUTE FUNCTION public.mail_messages_set_tenant();

DROP POLICY IF EXISTS tenant_data_scope_all ON public.mail_messages;
CREATE POLICY tenant_data_scope_all ON public.mail_messages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR public.has_tenant_access(tenant_id));