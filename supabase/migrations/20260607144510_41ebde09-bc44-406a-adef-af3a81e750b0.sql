
-- Phase 14: Mobile Techniker-App

CREATE TABLE IF NOT EXISTS public.dispatch_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  checklist_type text NOT NULL DEFAULT 'wartung',
  description text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.dispatch_checklists TO authenticated;
GRANT ALL ON public.dispatch_checklists TO service_role;
ALTER TABLE public.dispatch_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cl read" ON public.dispatch_checklists FOR SELECT TO authenticated
  USING (public.can_access_planning());
CREATE POLICY "cl write admin" ON public.dispatch_checklists FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "cl update admin" ON public.dispatch_checklists FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cl delete sa" ON public.dispatch_checklists FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_dispatch_checklists_updated ON public.dispatch_checklists;
CREATE TRIGGER trg_dispatch_checklists_updated BEFORE UPDATE ON public.dispatch_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dispatch_checklist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE CASCADE,
  checklist_id uuid REFERENCES public.dispatch_checklists(id),
  technician_user_id uuid REFERENCES auth.users(id),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.dispatch_checklist_runs TO authenticated;
GRANT ALL ON public.dispatch_checklist_runs TO service_role;
ALTER TABLE public.dispatch_checklist_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clr read" ON public.dispatch_checklist_runs FOR SELECT TO authenticated
  USING (public.can_access_planning());
CREATE POLICY "clr insert" ON public.dispatch_checklist_runs FOR INSERT TO authenticated
  WITH CHECK (public.can_access_planning());
CREATE POLICY "clr update" ON public.dispatch_checklist_runs FOR UPDATE TO authenticated
  USING (public.can_access_planning()) WITH CHECK (public.can_access_planning());
CREATE POLICY "clr delete sa" ON public.dispatch_checklist_runs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_dispatch_clr_updated ON public.dispatch_checklist_runs;
CREATE TRIGGER trg_dispatch_clr_updated BEFORE UPDATE ON public.dispatch_checklist_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dispatch_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  signer_name text,
  storage_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.dispatch_signatures TO authenticated;
GRANT ALL ON public.dispatch_signatures TO service_role;
ALTER TABLE public.dispatch_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sig read" ON public.dispatch_signatures FOR SELECT TO authenticated
  USING (public.can_access_planning());
CREATE POLICY "sig insert" ON public.dispatch_signatures FOR INSERT TO authenticated
  WITH CHECK (public.can_access_planning());
CREATE POLICY "sig update" ON public.dispatch_signatures FOR UPDATE TO authenticated
  USING (public.can_access_planning()) WITH CHECK (public.can_access_planning());
CREATE POLICY "sig delete sa" ON public.dispatch_signatures FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.mobile_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_push_subscriptions TO authenticated;
GRANT ALL ON public.mobile_push_subscriptions TO service_role;
ALTER TABLE public.mobile_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mps self" ON public.mobile_push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Seed: 4 Standard-Checklisten (idempotent)
INSERT INTO public.dispatch_checklists (name, checklist_type, description, items) VALUES
  ('Wartungs-Standardcheck', 'wartung', 'Allgemeine Wartung Lasergerät',
    '[{"id":"funktionstest","label":"Funktionstest durchgeführt","type":"bool"},{"id":"kuehlung","label":"Kühlung geprüft","type":"bool"},{"id":"filter","label":"Filter gewechselt","type":"bool"},{"id":"sichtkontrolle","label":"Sichtkontrolle Gehäuse","type":"bool"},{"id":"bemerkung","label":"Bemerkungen","type":"text"}]'::jsonb),
  ('Reparatur-Abnahme', 'reparatur', 'Abnahme nach Reparatur',
    '[{"id":"fehler_behoben","label":"Fehler behoben","type":"bool"},{"id":"testlauf","label":"Testlauf erfolgreich","type":"bool"},{"id":"kunde_eingewiesen","label":"Kunde eingewiesen","type":"bool"},{"id":"bemerkung","label":"Bemerkungen","type":"text"}]'::jsonb),
  ('Installations-Checkliste', 'installation', 'Erstinbetriebnahme',
    '[{"id":"aufstellung","label":"Aufstellung korrekt","type":"bool"},{"id":"strom","label":"Stromversorgung geprüft","type":"bool"},{"id":"einweisung","label":"Einweisung Kunde","type":"bool"},{"id":"dokumente","label":"Dokumente übergeben","type":"bool"},{"id":"bemerkung","label":"Bemerkungen","type":"text"}]'::jsonb),
  ('MDR-Konformitätscheck', 'mdr', 'MDR/CE Kontrolle Medizinprodukt',
    '[{"id":"ce_label","label":"CE-Label vorhanden","type":"bool"},{"id":"seriennummer","label":"Seriennummer dokumentiert","type":"bool"},{"id":"einweisung_dok","label":"Einweisung dokumentiert","type":"bool"},{"id":"vorkommnis","label":"Vorkommnis erkannt","type":"bool"},{"id":"bemerkung","label":"Bemerkungen","type":"text"}]'::jsonb)
ON CONFLICT DO NOTHING;
