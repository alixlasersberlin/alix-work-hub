ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'angebot_erstellt',
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS competitor text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS financing_type text,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_probability numeric,
  ADD COLUMN IF NOT EXISTS offer_score integer,
  ADD COLUMN IF NOT EXISTS ai_probability numeric,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_actions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_note text,
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_offers_stage ON public.offers(stage);
CREATE INDEX IF NOT EXISTS idx_offers_offer_date ON public.offers(offer_date DESC);
CREATE INDEX IF NOT EXISTS idx_offers_next_followup ON public.offers(next_followup_at);
CREATE INDEX IF NOT EXISTS idx_offers_created_by ON public.offers(created_by);

CREATE TABLE IF NOT EXISTS public.offer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  note text,
  outcome text,
  created_by uuid DEFAULT auth.uid(),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_activities TO authenticated;
GRANT ALL ON public.offer_activities TO service_role;

ALTER TABLE public.offer_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_activities_select" ON public.offer_activities
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id));

CREATE POLICY "offer_activities_insert" ON public.offer_activities
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id));

CREATE POLICY "offer_activities_update" ON public.offer_activities
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role('Super Admin') OR has_role('Admin'));

CREATE POLICY "offer_activities_delete" ON public.offer_activities
  FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_offer_activities_offer ON public.offer_activities(offer_id, created_at DESC);