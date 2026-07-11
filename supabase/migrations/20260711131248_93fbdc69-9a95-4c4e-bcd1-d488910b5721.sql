
-- Ersetzt die permissiven "true"-Policies auf esc_store_appointment_kinds
-- durch explizite Auth-Checks (fachlich identisch, weil die Policies bereits TO authenticated gelten).

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth insert" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth insert"
  ON public.esc_store_appointment_kinds
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth update" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth update"
  ON public.esc_store_appointment_kinds
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth delete" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth delete"
  ON public.esc_store_appointment_kinds
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
