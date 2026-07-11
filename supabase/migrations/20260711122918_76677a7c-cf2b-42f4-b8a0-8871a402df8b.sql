-- Allow anonymous read of publicly bookable departments for the /book portal
GRANT SELECT ON public.esc_store_departments TO anon;

CREATE POLICY "esc_store_departments public bookable read"
ON public.esc_store_departments
FOR SELECT
TO anon
USING (
  COALESCE((data->>'active')::boolean, false) = true
  AND COALESCE((data->>'publicBookable')::boolean, false) = true
  AND COALESCE((data->>'externallyBookable')::boolean, false) = true
);