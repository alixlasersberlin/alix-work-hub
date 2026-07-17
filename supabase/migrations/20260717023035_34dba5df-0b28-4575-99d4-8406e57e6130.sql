-- Öffne PDF-Import Bearbeitung für alle authentifizierten Rollen; Löschen bleibt Super Admin

CREATE OR REPLACE FUNCTION public.can_access_pdf_import(p_import_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_order_imports oi
    WHERE oi.id = p_import_id
      AND auth.uid() IS NOT NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_read_pdf_import(p_import_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_order_imports oi
    WHERE oi.id = p_import_id
      AND auth.uid() IS NOT NULL
  );
$function$;

DROP POLICY IF EXISTS pdfoi_select ON public.pdf_order_imports;
CREATE POLICY pdfoi_select ON public.pdf_order_imports
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS pdfoi_update ON public.pdf_order_imports;
CREATE POLICY pdfoi_update ON public.pdf_order_imports
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- INSERT: alle angemeldeten User dürfen hochladen
DROP POLICY IF EXISTS pdfoi_insert ON public.pdf_order_imports;
CREATE POLICY pdfoi_insert ON public.pdf_order_imports
  FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

-- DELETE bleibt Super Admin
DROP POLICY IF EXISTS pdfoi_delete ON public.pdf_order_imports;
CREATE POLICY pdfoi_delete ON public.pdf_order_imports
  FOR DELETE
  USING (has_role('Super Admin'));