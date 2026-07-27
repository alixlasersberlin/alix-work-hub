
-- esc_events: allow all authenticated users to read/insert/update
CREATE POLICY "esc_events_all_auth_read" ON public.esc_events
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "esc_events_all_auth_update" ON public.esc_events
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- esc_store_appointments: allow all authenticated users to read/insert/update
CREATE POLICY "esc_store_appt_all_auth_read" ON public.esc_store_appointments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "esc_store_appt_all_auth_insert" ON public.esc_store_appointments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "esc_store_appt_all_auth_update" ON public.esc_store_appointments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
