CREATE TABLE public.survey_recipient_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.survey_recipient_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.survey_recipient_groups(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_number text,
  company_name text,
  contact_name text,
  email text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (group_id, customer_id)
);

CREATE INDEX idx_srgm_group ON public.survey_recipient_group_members(group_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_recipient_groups TO authenticated;
GRANT ALL ON public.survey_recipient_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_recipient_group_members TO authenticated;
GRANT ALL ON public.survey_recipient_group_members TO service_role;

ALTER TABLE public.survey_recipient_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_recipient_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srg_read" ON public.survey_recipient_groups FOR SELECT TO authenticated USING (public.sv_can_read());
CREATE POLICY "srg_insert" ON public.survey_recipient_groups FOR INSERT TO authenticated WITH CHECK (public.sv_can_write());
CREATE POLICY "srg_update" ON public.survey_recipient_groups FOR UPDATE TO authenticated USING (public.sv_can_write()) WITH CHECK (public.sv_can_write());
CREATE POLICY "srg_delete" ON public.survey_recipient_groups FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE POLICY "srgm_read" ON public.survey_recipient_group_members FOR SELECT TO authenticated USING (public.sv_can_read());
CREATE POLICY "srgm_insert" ON public.survey_recipient_group_members FOR INSERT TO authenticated WITH CHECK (public.sv_can_write());
CREATE POLICY "srgm_update" ON public.survey_recipient_group_members FOR UPDATE TO authenticated USING (public.sv_can_write()) WITH CHECK (public.sv_can_write());
CREATE POLICY "srgm_delete" ON public.survey_recipient_group_members FOR DELETE TO authenticated USING (public.sv_can_write());

CREATE TRIGGER trg_srg_updated_at BEFORE UPDATE ON public.survey_recipient_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();