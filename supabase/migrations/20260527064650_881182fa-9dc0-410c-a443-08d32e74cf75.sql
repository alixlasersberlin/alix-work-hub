
CREATE TABLE public.system_maintenance (
  id boolean PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT 'Das System befindet sich aktuell in Wartung. Bitte versuchen Sie es später erneut.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT system_maintenance_singleton CHECK (id = true)
);

GRANT SELECT ON public.system_maintenance TO anon;
GRANT SELECT, INSERT, UPDATE ON public.system_maintenance TO authenticated;
GRANT ALL ON public.system_maintenance TO service_role;

ALTER TABLE public.system_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maintenance status"
ON public.system_maintenance FOR SELECT
USING (true);

CREATE POLICY "Only Super Admin can insert maintenance"
ON public.system_maintenance FOR INSERT TO authenticated
WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "Only Super Admin can update maintenance"
ON public.system_maintenance FOR UPDATE TO authenticated
USING (public.has_role('Super Admin'))
WITH CHECK (public.has_role('Super Admin'));

INSERT INTO public.system_maintenance (id, enabled, message) VALUES (true, false, 'Das System befindet sich aktuell in Wartung. Bitte versuchen Sie es später erneut.')
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_maintenance;
ALTER TABLE public.system_maintenance REPLICA IDENTITY FULL;
