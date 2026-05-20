
-- Function to clear the factory invoice PDF reference
CREATE OR REPLACE FUNCTION public.clear_factory_invoice_pdf(_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.can_upload_factory_invoice()) THEN
    RAISE EXCEPTION 'Not authorized to delete factory invoice';
  END IF;

  UPDATE public.production_orders
     SET invoice_pdf_path = NULL,
         updated_at = now()
   WHERE id = _production_order_id;
END;
$function$;

-- Storage: allow factory invoice role to delete invoice files in production-orders bucket
CREATE POLICY "factory invoice can delete invoice files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'production-orders'
  AND public.can_upload_factory_invoice()
  AND (storage.foldername(name))[1] = 'invoices'
);
