ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS design jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.survey_design_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  key text,
  name text NOT NULL,
  description text,
  category text,
  preview_image_url text,
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_design_templates TO authenticated;
GRANT ALL ON public.survey_design_templates TO service_role;

ALTER TABLE public.survey_design_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdt_read" ON public.survey_design_templates
  FOR SELECT TO authenticated USING (public.sv_can_read());
CREATE POLICY "sdt_insert" ON public.survey_design_templates
  FOR INSERT TO authenticated WITH CHECK (public.sv_can_write());
CREATE POLICY "sdt_update" ON public.survey_design_templates
  FOR UPDATE TO authenticated USING (public.sv_can_write()) WITH CHECK (public.sv_can_write());
CREATE POLICY "sdt_delete" ON public.survey_design_templates
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_sdt_updated_at BEFORE UPDATE ON public.survey_design_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();