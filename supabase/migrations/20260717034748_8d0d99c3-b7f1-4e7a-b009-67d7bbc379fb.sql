
-- Restrict alix_applications SELECT to admins
DROP POLICY IF EXISTS aa_select_all ON public.alix_applications;
CREATE POLICY aa_select_admin ON public.alix_applications
  FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));

-- Tighten pdf import access functions to require operational roles
CREATE OR REPLACE FUNCTION public.can_read_pdf_import(p_import_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_order_imports oi
    WHERE oi.id = p_import_id
      AND auth.uid() IS NOT NULL
      AND (
        oi.uploaded_by = auth.uid()
        OR public.has_role('Super Admin')
        OR public.has_role('Admin')
        OR public.has_role('Order')
        OR public.has_role('Vertrieb')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_pdf_import(p_import_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_order_imports oi
    WHERE oi.id = p_import_id
      AND auth.uid() IS NOT NULL
      AND (
        oi.uploaded_by = auth.uid()
        OR public.has_role('Super Admin')
        OR public.has_role('Admin')
        OR public.has_role('Order')
      )
  );
$$;

-- Also tighten pdf_order_imports table policies to the same rule
DROP POLICY IF EXISTS pdfoi_select ON public.pdf_order_imports;
CREATE POLICY pdfoi_select ON public.pdf_order_imports
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Order')
    OR public.has_role('Vertrieb')
  );

DROP POLICY IF EXISTS pdfoi_update ON public.pdf_order_imports;
CREATE POLICY pdfoi_update ON public.pdf_order_imports
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Order')
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Order')
  );
