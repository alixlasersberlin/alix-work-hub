
-- Neue Tabelle für zentral verwaltete Terminarten (intern + öffentliches Buchungsportal).
CREATE TABLE IF NOT EXISTS public.esc_store_appointment_kinds (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_store_appointment_kinds TO authenticated;
GRANT ALL ON public.esc_store_appointment_kinds TO service_role;

ALTER TABLE public.esc_store_appointment_kinds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth read" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth read"
  ON public.esc_store_appointment_kinds FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth insert" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth insert"
  ON public.esc_store_appointment_kinds FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth update" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth update"
  ON public.esc_store_appointment_kinds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "esc_store_appointment_kinds auth delete" ON public.esc_store_appointment_kinds;
CREATE POLICY "esc_store_appointment_kinds auth delete"
  ON public.esc_store_appointment_kinds FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS esc_store_appointment_kinds_touch ON public.esc_store_appointment_kinds;
CREATE TRIGGER esc_store_appointment_kinds_touch BEFORE UPDATE ON public.esc_store_appointment_kinds
  FOR EACH ROW EXECUTE FUNCTION public.esc_store_touch_updated_at();

DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.esc_store_appointment_kinds';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Öffentliche RPC für anonyme Buchungsseite: nur sichere Felder, nur aktive/öffentlich buchbare.
CREATE OR REPLACE FUNCTION public.esc_public_appointment_kinds()
RETURNS TABLE (id text, data jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.id,
         jsonb_build_object(
           'id',                     k.data->>'id',
           'name',                   k.data->>'name',
           'description',            k.data->>'description',
           'color',                  k.data->>'color',
           'icon',                   k.data->>'icon',
           'defaultDurationMinutes', (k.data->>'defaultDurationMinutes')::int,
           'active',                 (k.data->>'active')::boolean,
           'publicBookable',         (k.data->>'publicBookable')::boolean,
           'departmentIds',          COALESCE(k.data->'departmentIds', '[]'::jsonb)
         ) AS data
  FROM public.esc_store_appointment_kinds k
  WHERE COALESCE((k.data->>'active')::boolean, false)
    AND COALESCE((k.data->>'publicBookable')::boolean, false);
$$;

REVOKE ALL ON FUNCTION public.esc_public_appointment_kinds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esc_public_appointment_kinds() TO anon, authenticated;
