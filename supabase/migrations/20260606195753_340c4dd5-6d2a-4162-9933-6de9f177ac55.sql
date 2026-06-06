
-- AI Service Assistent: Tabellen, Grants, RLS, Indizes

-- 1) Wissensdatenbank
CREATE TABLE IF NOT EXISTS public.service_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geraetetyp text,
  fehlercode text,
  symptom text NOT NULL,
  ursache text,
  loesung text,
  ersatzteile jsonb DEFAULT '[]'::jsonb,
  arbeitszeit_min int,
  arbeitszeit_erwartet int,
  arbeitszeit_max int,
  tags text[] DEFAULT ARRAY[]::text[],
  quelle text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_knowledge_base TO authenticated;
GRANT ALL ON public.service_knowledge_base TO service_role;
ALTER TABLE public.service_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_select" ON public.service_knowledge_base FOR SELECT TO authenticated
USING (public.can_access_repair() OR public.can_access_tickets());
CREATE POLICY "kb_insert" ON public.service_knowledge_base FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Technik'));
CREATE POLICY "kb_update" ON public.service_knowledge_base FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Technik'))
WITH CHECK (public.is_admin() OR public.has_role('Technik'));
CREATE POLICY "kb_delete" ON public.service_knowledge_base FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_kb_geraetetyp ON public.service_knowledge_base(geraetetyp);
CREATE INDEX IF NOT EXISTS idx_kb_fehlercode ON public.service_knowledge_base(fehlercode);

-- 2) AI Analysen
CREATE TABLE IF NOT EXISTS public.service_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid,
  repair_order_id uuid,
  source_kind text NOT NULL CHECK (source_kind IN ('ticket','repair')),
  device_type text,
  device_model text,
  serial_number text,
  fehlercode text,
  prompt_summary text,
  ursache text,
  confidence numeric,
  pruefschritte jsonb DEFAULT '[]'::jsonb,
  reparatur_empfehlung text,
  ersatzteile jsonb DEFAULT '[]'::jsonb,
  arbeitszeit jsonb,
  technikerempfehlung jsonb,
  raw_response jsonb,
  model text,
  tokens_input int,
  tokens_output int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_ai_analyses TO authenticated;
GRANT ALL ON public.service_ai_analyses TO service_role;
ALTER TABLE public.service_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analyses_select" ON public.service_ai_analyses FOR SELECT TO authenticated
USING (public.can_access_repair() OR public.can_access_tickets() OR public.can_access_finance());
CREATE POLICY "analyses_insert" ON public.service_ai_analyses FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme'));
CREATE POLICY "analyses_update" ON public.service_ai_analyses FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Technik'))
WITH CHECK (public.is_admin() OR public.has_role('Technik'));
CREATE POLICY "analyses_delete" ON public.service_ai_analyses FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_analyses_ticket ON public.service_ai_analyses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_analyses_repair ON public.service_ai_analyses(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON public.service_ai_analyses(created_at DESC);

-- 3) Reparaturanleitungen
CREATE TABLE IF NOT EXISTS public.service_ai_repair_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.service_ai_analyses(id) ON DELETE SET NULL,
  ticket_id uuid,
  repair_order_id uuid,
  titel text,
  pruefschritte jsonb DEFAULT '[]'::jsonb,
  reparaturschritte jsonb DEFAULT '[]'::jsonb,
  sicherheit jsonb DEFAULT '[]'::jsonb,
  abschlusspruefung jsonb DEFAULT '[]'::jsonb,
  pdf_path text,
  model text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_ai_repair_guides TO authenticated;
GRANT ALL ON public.service_ai_repair_guides TO service_role;
ALTER TABLE public.service_ai_repair_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guides_select" ON public.service_ai_repair_guides FOR SELECT TO authenticated
USING (public.can_access_repair() OR public.can_access_tickets() OR public.can_access_finance());
CREATE POLICY "guides_insert" ON public.service_ai_repair_guides FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme'));
CREATE POLICY "guides_update" ON public.service_ai_repair_guides FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Technik'))
WITH CHECK (public.is_admin() OR public.has_role('Technik'));
CREATE POLICY "guides_delete" ON public.service_ai_repair_guides FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

-- 4) Feedback
CREATE TABLE IF NOT EXISTS public.service_ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.service_ai_analyses(id) ON DELETE CASCADE,
  rating smallint CHECK (rating IN (-1, 1)),
  korrektur text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_ai_feedback TO authenticated;
GRANT ALL ON public.service_ai_feedback TO service_role;
ALTER TABLE public.service_ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_select" ON public.service_ai_feedback FOR SELECT TO authenticated
USING (public.can_access_repair() OR public.can_access_tickets());
CREATE POLICY "feedback_insert" ON public.service_ai_feedback FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme'));
CREATE POLICY "feedback_delete" ON public.service_ai_feedback FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

-- updated_at trigger für KB
CREATE TRIGGER trg_service_kb_updated_at
BEFORE UPDATE ON public.service_knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Access helper für UI/Routing
CREATE OR REPLACE FUNCTION public.can_access_ai_service()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance');
$$;

CREATE OR REPLACE FUNCTION public.can_run_ai_service()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme');
$$;
