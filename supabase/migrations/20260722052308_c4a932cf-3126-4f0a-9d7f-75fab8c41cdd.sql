
CREATE TABLE IF NOT EXISTS public.alixdocs2_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.alixdocs2_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs2_comments TO authenticated;
GRANT ALL ON public.alixdocs2_comments TO service_role;
ALTER TABLE public.alixdocs2_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adc2c read admin" ON public.alixdocs2_comments FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "adc2c insert admin" ON public.alixdocs2_comments FOR INSERT TO authenticated
  WITH CHECK ((public.has_role('Super Admin') OR public.has_role('Admin')) AND user_id = auth.uid());
CREATE POLICY "adc2c update own or super" ON public.alixdocs2_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin'));
CREATE POLICY "adc2c delete own or super" ON public.alixdocs2_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_adc2_comments_doc ON public.alixdocs2_comments(document_id, created_at DESC);

ALTER TABLE public.alixdocs2_documents
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

ALTER TABLE public.alixdocs2_doctypes
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false;
