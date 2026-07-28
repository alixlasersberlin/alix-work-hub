
INSERT INTO public.roles (name, description) VALUES
  ('Marketing', 'Social Media Marketing – Content, Kampagnen, Freigaben, Analyse'),
  ('Grafiker', 'Social Media Grafik – Medienbibliothek, Bildgenerator, Content-Erstellung')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.social_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_social()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin')
      OR public.has_role('Marketing') OR public.has_role('Grafiker');
$$;

CREATE OR REPLACE FUNCTION public.can_admin_social()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin');
$$;

CREATE TABLE IF NOT EXISTS public.social_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NULL,
  owner_user_id uuid NULL,
  company_name text NOT NULL,
  contact_person text, phone text, mobile text, email text, website text, industry text,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  logo_url text,
  corporate_colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  corporate_fonts jsonb NOT NULL DEFAULT '[]'::jsonb,
  onboarding_status text NOT NULL DEFAULT 'not_started',
  onboarding_step int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_clients TO authenticated;
GRANT ALL ON public.social_clients TO service_role;
ALTER TABLE public.social_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_read"   ON public.social_clients FOR SELECT TO authenticated USING (public.can_manage_social() OR owner_user_id = auth.uid());
CREATE POLICY "sc_insert" ON public.social_clients FOR INSERT TO authenticated WITH CHECK (public.can_manage_social() OR owner_user_id = auth.uid());
CREATE POLICY "sc_update" ON public.social_clients FOR UPDATE TO authenticated USING (public.can_manage_social() OR owner_user_id = auth.uid()) WITH CHECK (public.can_manage_social() OR owner_user_id = auth.uid());
CREATE POLICY "sc_delete" ON public.social_clients FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_sc_touch BEFORE UPDATE ON public.social_clients FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_sc_owner ON public.social_clients(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sc_customer ON public.social_clients(customer_id);

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text, email text,
  auth_type text NOT NULL DEFAULT 'password',
  connected boolean NOT NULL DEFAULT false,
  has_2fa boolean NOT NULL DEFAULT false,
  oauth_provider text, oauth_connected_at timestamptz,
  note text,
  status text NOT NULL DEFAULT 'not_connected',
  last_check_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_read"  ON public.social_accounts FOR SELECT TO authenticated USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE POLICY "sa_write" ON public.social_accounts FOR ALL TO authenticated USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid())) WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_sa_touch BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_sa_client ON public.social_accounts(client_id);

CREATE TABLE IF NOT EXISTS public.social_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  algo text NOT NULL DEFAULT 'AES-256-GCM',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_credentials TO service_role;
ALTER TABLE public.social_credentials ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_scr_account ON public.social_credentials(account_id);
CREATE TRIGGER trg_scr_touch BEFORE UPDATE ON public.social_credentials FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.social_questionnaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_questionnaire TO authenticated;
GRANT ALL ON public.social_questionnaire TO service_role;
ALTER TABLE public.social_questionnaire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sq_rw" ON public.social_questionnaire FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_sq_touch BEFORE UPDATE ON public.social_questionnaire FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS uq_sq_client ON public.social_questionnaire(client_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.social_media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  file_name text NOT NULL, storage_path text NOT NULL,
  mime_type text, size_bytes bigint, category text,
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_media_library TO authenticated;
GRANT ALL ON public.social_media_library TO service_role;
ALTER TABLE public.social_media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sml_rw" ON public.social_media_library FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_sml_touch BEFORE UPDATE ON public.social_media_library FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_sml_client ON public.social_media_library(client_id);

CREATE TABLE IF NOT EXISTS public.social_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  name text NOT NULL, platform text, goal text,
  budget_cents bigint DEFAULT 0,
  starts_at timestamptz, ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  leads int DEFAULT 0, conversions int DEFAULT 0, cost_cents bigint DEFAULT 0, roi numeric DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_campaigns TO authenticated;
GRANT ALL ON public.social_campaigns TO service_role;
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scmp_rw" ON public.social_campaigns FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_scmp_touch BEFORE UPDATE ON public.social_campaigns FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.social_campaigns(id) ON DELETE SET NULL,
  platform text NOT NULL,
  title text, body text,
  media_ids uuid[] NOT NULL DEFAULT '{}',
  hashtags text[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz, published_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  version int NOT NULL DEFAULT 1,
  author_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_rw" ON public.social_posts FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_sp_touch BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_sp_client_status ON public.social_posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_sp_schedule ON public.social_posts(scheduled_at);

CREATE TABLE IF NOT EXISTS public.social_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  requested_by uuid, decided_by uuid,
  decision text NOT NULL DEFAULT 'pending',
  comment text, version int NOT NULL DEFAULT 1,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_approvals TO authenticated;
GRANT ALL ON public.social_approvals TO service_role;
ALTER TABLE public.social_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sap_rw" ON public.social_approvals FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_posts p JOIN public.social_clients c ON c.id=p.client_id WHERE p.id=post_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_posts p JOIN public.social_clients c ON c.id=p.client_id WHERE p.id=post_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_sap_touch BEFORE UPDATE ON public.social_approvals FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.social_clients(id) ON DELETE CASCADE,
  author_id uuid, body text NOT NULL,
  channel text NOT NULL DEFAULT 'internal',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comments TO authenticated;
GRANT ALL ON public.social_comments TO service_role;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scmn_rw" ON public.social_comments FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.social_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  title text NOT NULL, description text,
  priority text NOT NULL DEFAULT 'normal',
  assignee_id uuid, due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_tasks TO authenticated;
GRANT ALL ON public.social_tasks TO service_role;
ALTER TABLE public.social_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "st_rw" ON public.social_tasks FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));
CREATE TRIGGER trg_st_touch BEFORE UPDATE ON public.social_tasks FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.social_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  captured_on date NOT NULL DEFAULT current_date,
  followers int, likes int, comments int, shares int, reach int, clicks int, leads int,
  engagement numeric, cost_cents bigint, roi numeric,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_statistics TO authenticated;
GRANT ALL ON public.social_statistics TO service_role;
ALTER TABLE public.social_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sst_rw" ON public.social_statistics FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social());

CREATE TABLE IF NOT EXISTS public.social_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  kind text NOT NULL, prompt text NOT NULL,
  result_text text, result_url text, model text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_ai_generations TO authenticated;
GRANT ALL ON public.social_ai_generations TO service_role;
ALTER TABLE public.social_ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sag_rw" ON public.social_ai_generations FOR ALL TO authenticated
  USING (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()))
  WITH CHECK (public.can_manage_social() OR EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.social_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.social_clients(id) ON DELETE CASCADE,
  user_id uuid, kind text NOT NULL, title text NOT NULL,
  body text, link text, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_notifications TO authenticated;
GRANT ALL ON public.social_notifications TO service_role;
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sn_read"  ON public.social_notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_manage_social());
CREATE POLICY "sn_write" ON public.social_notifications FOR ALL TO authenticated USING (public.can_manage_social()) WITH CHECK (public.can_manage_social());

CREATE TABLE IF NOT EXISTS public.social_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.social_clients(id) ON DELETE SET NULL,
  actor_id uuid, action text NOT NULL,
  entity_type text, entity_id uuid,
  ip inet, user_agent text, country text, device text,
  before_data jsonb, after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.social_activity_logs TO authenticated;
GRANT ALL ON public.social_activity_logs TO service_role;
ALTER TABLE public.social_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sal_read"   ON public.social_activity_logs FOR SELECT TO authenticated USING (public.can_admin_social() OR (client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.social_clients c WHERE c.id=client_id AND c.owner_user_id=auth.uid())));
CREATE POLICY "sal_insert" ON public.social_activity_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR public.can_manage_social());

CREATE POLICY "sml_bucket_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='social-media-library' AND public.can_manage_social());
CREATE POLICY "sml_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='social-media-library' AND public.can_manage_social());
CREATE POLICY "sml_bucket_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='social-media-library' AND public.can_manage_social());
CREATE POLICY "sml_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='social-media-library' AND public.has_role('Super Admin'));
