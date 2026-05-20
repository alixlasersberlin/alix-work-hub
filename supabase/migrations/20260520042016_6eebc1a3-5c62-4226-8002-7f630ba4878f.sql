
-- 1. New role
INSERT INTO public.roles (name, description)
VALUES ('FACTORY INVOICE', 'Darf Lieferanten-Rechnungen (Factory Invoice PDFs) zu Bestellungen hochladen')
ON CONFLICT (name) DO NOTHING;

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.can_upload_factory_invoice()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('FACTORY INVOICE');
$$;

-- 3. RLS on production_orders: allow FACTORY INVOICE role to read all approved orders (für Übersicht)
DROP POLICY IF EXISTS "factory invoice can read production orders" ON public.production_orders;
CREATE POLICY "factory invoice can read production orders"
ON public.production_orders
FOR SELECT
TO authenticated
USING (public.can_upload_factory_invoice());

-- 4. Storage policies on production-orders bucket for invoice uploads (invoices/ prefix)
DROP POLICY IF EXISTS "factory invoice upload invoice pdfs" ON storage.objects;
CREATE POLICY "factory invoice upload invoice pdfs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'production-orders'
  AND public.can_upload_factory_invoice()
  AND (storage.foldername(name))[1] = 'invoices'
);

DROP POLICY IF EXISTS "factory invoice read invoice pdfs" ON storage.objects;
CREATE POLICY "factory invoice read invoice pdfs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'production-orders'
  AND public.can_upload_factory_invoice()
  AND (storage.foldername(name))[1] = 'invoices'
);

-- 5. Security definer RPC to set invoice_pdf_path on production_orders
CREATE OR REPLACE FUNCTION public.set_factory_invoice_pdf(_production_order_id uuid, _path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.can_upload_factory_invoice()) THEN
    RAISE EXCEPTION 'Not authorized to upload factory invoice';
  END IF;

  UPDATE public.production_orders
     SET invoice_pdf_path = _path,
         updated_at = now()
   WHERE id = _production_order_id;
END;
$$;
