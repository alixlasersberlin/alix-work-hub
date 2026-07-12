
-- 1) Restrict esc_signatures insert policy to authenticated role
DROP POLICY IF EXISTS "esc_signatures manage insert" ON public.esc_signatures;
CREATE POLICY "esc_signatures manage insert"
ON public.esc_signatures
FOR INSERT
TO authenticated
WITH CHECK (can_manage_esc_master());

-- 2) Remove non-whitelisted tables from the supabase_realtime publication
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'esc_store_appointments',
    'esc_store_departments',
    'esc_store_employees',
    'esc_store_rm_employees',
    'esc_store_rm_vehicles',
    'esc_store_rm_rooms',
    'esc_store_rm_demo_devices',
    'esc_store_rm_absences',
    'esc_store_rm_maintenance',
    'esc_store_rm_locations',
    'esc_store_rm_qualifications',
    'esc_store_appointment_kinds',
    'offer_followup_tasks',
    'offer_outcomes',
    'media_package_comments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
