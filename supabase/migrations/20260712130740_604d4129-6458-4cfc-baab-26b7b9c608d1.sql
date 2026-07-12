
DO $$ BEGIN
  CREATE TYPE public.ticket_routing_strategy AS ENUM (
    'manual','round_robin','region','product','account_manager','least_load'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.ticket_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3B82F6',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  allow_customer_pick_person boolean NOT NULL DEFAULT false,
  routing_strategy public.ticket_routing_strategy NOT NULL DEFAULT 'least_load',
  mailbox_email text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_departments TO authenticated;
GRANT ALL ON public.ticket_departments TO service_role;

ALTER TABLE public.ticket_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_departments read active anon"
  ON public.ticket_departments FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "ticket_departments read authenticated"
  ON public.ticket_departments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ticket_departments insert super admin"
  ON public.ticket_departments FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "ticket_departments update super admin"
  ON public.ticket_departments FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "ticket_departments delete super admin"
  ON public.ticket_departments FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_ticket_departments_updated_at
  BEFORE UPDATE ON public.ticket_departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ticket_departments (name, slug, color, sort_order) VALUES
  ('Service',                    'service',          '#3B82F6', 10),
  ('Technik',                    'technik',          '#1D4ED8', 20),
  ('Lieferung',                  'lieferung',        '#F97316', 30),
  ('Schulung',                   'schulung',         '#10B981', 40),
  ('NiSV Schulung Virtuell',     'nisv-virtuell',    '#8B5CF6', 50),
  ('NiSV Präsenz',               'nisv-praesenz',    '#7C3AED', 60),
  ('Mediapaket',                 'mediapaket',       '#EC4899', 70),
  ('Sales',                      'sales',            '#14B8A6', 80),
  ('Buchhaltung',                'buchhaltung',      '#64748B', 90),
  ('Reklamation',                'reklamation',      '#EF4444', 100),
  ('Sonstige',                   'sonstige',         '#94A3B8', 999)
ON CONFLICT (slug) DO NOTHING;
