-- 1. Rolle 'Lieferant' anlegen (idempotent)
INSERT INTO public.roles (name, description)
SELECT 'Lieferant', 'Externer Lieferant mit Zugriff nur auf eigene Production Orders'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Lieferant');

-- 2. supplier_id im user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_supplier_id ON public.user_profiles(supplier_id);

-- 3. Helper-Funktionen
CREATE OR REPLACE FUNCTION public.is_supplier()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role('Lieferant');
$$;

CREATE OR REPLACE FUNCTION public.current_supplier_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT supplier_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 4. user_profiles self-update trigger erweitern: supplier_id darf nur Admin ändern
CREATE OR REPLACE FUNCTION public.check_user_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.invitation_status IS DISTINCT FROM OLD.invitation_status
     OR NEW.password_reset_required IS DISTINCT FROM OLD.password_reset_required
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.last_otp_verified_at IS DISTINCT FROM OLD.last_otp_verified_at
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
  THEN
    RAISE EXCEPTION 'You are not allowed to modify restricted profile fields';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. RLS: production_orders – Lieferant darf eigene SEHEN und STATUS updaten
DROP POLICY IF EXISTS "suppliers can read own production orders" ON public.production_orders;
CREATE POLICY "suppliers can read own production orders"
  ON public.production_orders FOR SELECT
  TO authenticated
  USING (
    public.is_supplier()
    AND supplier_id = public.current_supplier_id()
  );

DROP POLICY IF EXISTS "suppliers can update own production orders" ON public.production_orders;
CREATE POLICY "suppliers can update own production orders"
  ON public.production_orders FOR UPDATE
  TO authenticated
  USING (
    public.is_supplier()
    AND supplier_id = public.current_supplier_id()
  )
  WITH CHECK (
    public.is_supplier()
    AND supplier_id = public.current_supplier_id()
  );

-- 6. RLS: production_order_items – Lieferant darf eigene LESEN
DROP POLICY IF EXISTS "suppliers can read own production order items" ON public.production_order_items;
CREATE POLICY "suppliers can read own production order items"
  ON public.production_order_items FOR SELECT
  TO authenticated
  USING (
    public.is_supplier()
    AND EXISTS (
      SELECT 1 FROM public.production_orders po
      WHERE po.id = production_order_items.production_order_id
        AND po.supplier_id = public.current_supplier_id()
    )
  );

-- 7. RLS: suppliers – Lieferant darf eigenen Eintrag lesen
DROP POLICY IF EXISTS "suppliers can read own supplier record" ON public.suppliers;
CREATE POLICY "suppliers can read own supplier record"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (
    public.is_supplier()
    AND id = public.current_supplier_id()
  );

-- 8. Storage: production-orders Bucket – Lieferant darf eigene PDFs lesen
DROP POLICY IF EXISTS "suppliers can read own production order pdfs" ON storage.objects;
CREATE POLICY "suppliers can read own production order pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'production-orders'
    AND public.is_supplier()
    AND EXISTS (
      SELECT 1 FROM public.production_orders po
      WHERE po.pdf_path = storage.objects.name
        AND po.supplier_id = public.current_supplier_id()
    )
  );

-- 9. Admins behalten vollen Storage-Zugriff (sicherstellen)
DROP POLICY IF EXISTS "admins manage production order pdfs" ON storage.objects;
CREATE POLICY "admins manage production order pdfs"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'production-orders' AND public.is_admin())
  WITH CHECK (bucket_id = 'production-orders' AND public.is_admin());