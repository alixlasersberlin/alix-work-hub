-- 1. Add photo path columns
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS photo_front_path text,
  ADD COLUMN IF NOT EXISTS photo_right_path text,
  ADD COLUMN IF NOT EXISTS photo_left_path  text;

-- 2. Create private storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-photos', 'production-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for this bucket

-- Admins: full access
CREATE POLICY "production-photos admins read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'production-photos' AND public.is_admin());

CREATE POLICY "production-photos admins insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'production-photos' AND public.is_admin());

CREATE POLICY "production-photos admins update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'production-photos' AND public.is_admin())
WITH CHECK (bucket_id = 'production-photos' AND public.is_admin());

CREATE POLICY "production-photos admins delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'production-photos' AND public.is_admin());

-- Suppliers: only inside their own supplier folder (first path segment = supplier_id)
CREATE POLICY "production-photos suppliers read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'production-photos'
  AND public.is_supplier()
  AND (storage.foldername(name))[1] = public.current_supplier_id()::text
);

CREATE POLICY "production-photos suppliers insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'production-photos'
  AND public.is_supplier()
  AND (storage.foldername(name))[1] = public.current_supplier_id()::text
);

CREATE POLICY "production-photos suppliers update own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'production-photos'
  AND public.is_supplier()
  AND (storage.foldername(name))[1] = public.current_supplier_id()::text
)
WITH CHECK (
  bucket_id = 'production-photos'
  AND public.is_supplier()
  AND (storage.foldername(name))[1] = public.current_supplier_id()::text
);