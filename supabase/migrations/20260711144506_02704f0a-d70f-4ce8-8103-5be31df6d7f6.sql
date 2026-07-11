
-- =========================================================
-- PHASE 1: MEDIAPAKET FOUNDATION
-- =========================================================

INSERT INTO public.roles (name, description)
VALUES ('Mediapaket', 'Bearbeitung des Mediapaket-Moduls (Webseite, Flyer, Social Media)')
ON CONFLICT (name) DO NOTHING;

DO $$ BEGIN
  CREATE TYPE public.media_package_status AS ENUM (
    'not_started','in_progress','question_required','submitted',
    'in_review','in_production','customer_correction','approval_pending','completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.media_package_service_type AS ENUM ('website','flyer','social_media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.mp_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.can_manage_media_packages()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin')
      OR public.has_role('Mediapaket') OR public.has_role('Order');
$$;

CREATE OR REPLACE FUNCTION public.can_read_media_packages()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_media_packages()
      OR public.has_role('Read Only Audit')
      OR public.has_role('After Sales')
      OR public.has_role('SACHBEARBEITUNG');
$$;

-- CORE
CREATE TABLE IF NOT EXISTS public.media_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  studio_name TEXT,
  status public.media_package_status NOT NULL DEFAULT 'not_started',
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal',
  language TEXT DEFAULT 'de',
  country TEXT DEFAULT 'DE',
  due_date DATE,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  current_version INT NOT NULL DEFAULT 1,
  internal_notes TEXT,
  source TEXT DEFAULT 'alixwork',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_packages_customer ON public.media_packages(customer_id);
CREATE INDEX IF NOT EXISTS idx_media_packages_order ON public.media_packages(order_id);
CREATE INDEX IF NOT EXISTS idx_media_packages_status ON public.media_packages(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_packages_order ON public.media_packages(order_id) WHERE order_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_packages TO authenticated;
GRANT ALL ON public.media_packages TO service_role;
ALTER TABLE public.media_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_read_staff" ON public.media_packages FOR SELECT TO authenticated USING (public.can_read_media_packages());
CREATE POLICY "mp_write_staff" ON public.media_packages FOR INSERT TO authenticated WITH CHECK (public.can_manage_media_packages());
CREATE POLICY "mp_update_staff" ON public.media_packages FOR UPDATE TO authenticated USING (public.can_manage_media_packages()) WITH CHECK (public.can_manage_media_packages());
CREATE POLICY "mp_delete_super_admin" ON public.media_packages FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_media_packages_touch BEFORE UPDATE ON public.media_packages FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_media_package(_mp_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.media_packages mp WHERE mp.id = _mp_id) AND public.can_read_media_packages();
$$;
CREATE OR REPLACE FUNCTION public.can_write_media_package(_mp_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.media_packages mp WHERE mp.id = _mp_id) AND public.can_manage_media_packages();
$$;

-- SERVICES
CREATE TABLE IF NOT EXISTS public.media_package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  service_type public.media_package_service_type NOT NULL,
  selected BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'not_selected',
  assigned_department TEXT,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_package_id, service_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_services TO authenticated;
GRANT ALL ON public.media_package_services TO service_role;
ALTER TABLE public.media_package_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mps_read" ON public.media_package_services FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mps_write" ON public.media_package_services FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mps_touch BEFORE UPDATE ON public.media_package_services FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- STUDIO DATA
CREATE TABLE IF NOT EXISTS public.media_package_studio_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL UNIQUE REFERENCES public.media_packages(id) ON DELETE CASCADE,
  studio_name TEXT, contact_name TEXT, desired_domain TEXT, alternative_domain TEXT,
  existing_domain TEXT, domain_registered TEXT, company_name_website TEXT, company_name_print TEXT,
  slogan TEXT, preferred_salutation TEXT, preferred_tone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_studio_data TO authenticated;
GRANT ALL ON public.media_package_studio_data TO service_role;
ALTER TABLE public.media_package_studio_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpstudio_read" ON public.media_package_studio_data FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpstudio_write" ON public.media_package_studio_data FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpstudio_touch BEFORE UPDATE ON public.media_package_studio_data FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- DEVICES
CREATE TABLE IF NOT EXISTS public.media_package_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.lager_devices(id) ON DELETE SET NULL,
  entered_model_name TEXT, serial_number TEXT, confirmed BOOLEAN DEFAULT false,
  discrepancy_note TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_devices TO authenticated;
GRANT ALL ON public.media_package_devices TO service_role;
ALTER TABLE public.media_package_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpdev_read" ON public.media_package_devices FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpdev_write" ON public.media_package_devices FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpdev_touch BEFORE UPDATE ON public.media_package_devices FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- PRICES
CREATE TABLE IF NOT EXISTS public.media_package_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  category TEXT, treatment_name TEXT NOT NULL, description TEXT, duration_minutes INT,
  regular_price NUMERIC(10,2), promotional_price NUMERIC(10,2), package_price NUMERIC(10,2),
  target_group TEXT, body_area TEXT, device_id UUID REFERENCES public.lager_devices(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true, sort_order INT DEFAULT 0, notes TEXT, source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mpprices_mp ON public.media_package_prices(media_package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_prices TO authenticated;
GRANT ALL ON public.media_package_prices TO service_role;
ALTER TABLE public.media_package_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpprices_read" ON public.media_package_prices FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpprices_write" ON public.media_package_prices FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpprices_touch BEFORE UPDATE ON public.media_package_prices FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- CONTACT
CREATE TABLE IF NOT EXISTS public.media_package_contact_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL UNIQUE REFERENCES public.media_packages(id) ON DELETE CASCADE,
  company_name TEXT, studio_name TEXT, contact_name TEXT,
  address_line TEXT, street TEXT, house_number TEXT, address_extra TEXT,
  postal_code TEXT, city TEXT, state TEXT, country TEXT,
  phone TEXT, mobile TEXT, whatsapp TEXT, email TEXT, secondary_email TEXT,
  website TEXT, instagram TEXT, tiktok TEXT, facebook TEXT, youtube TEXT, linkedin TEXT,
  booking_url TEXT, google_business_url TEXT, preferred_contact_channel TEXT,
  sync_mode TEXT DEFAULT 'package_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_contact_data TO authenticated;
GRANT ALL ON public.media_package_contact_data TO service_role;
ALTER TABLE public.media_package_contact_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpcontact_read" ON public.media_package_contact_data FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpcontact_write" ON public.media_package_contact_data FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpcontact_touch BEFORE UPDATE ON public.media_package_contact_data FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- OPENING HOURS
CREATE TABLE IF NOT EXISTS public.media_package_opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  closed BOOLEAN NOT NULL DEFAULT false,
  first_start TIME, first_end TIME, second_start TIME, second_end TIME,
  by_appointment BOOLEAN DEFAULT false, notes TEXT,
  mode TEXT DEFAULT 'fixed', holiday_note TEXT, booking_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_package_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_opening_hours TO authenticated;
GRANT ALL ON public.media_package_opening_hours TO service_role;
ALTER TABLE public.media_package_opening_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpoh_read" ON public.media_package_opening_hours FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpoh_write" ON public.media_package_opening_hours FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpoh_touch BEFORE UPDATE ON public.media_package_opening_hours FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- TREATMENTS
CREATE TABLE IF NOT EXISTS public.media_package_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  treatment_name TEXT NOT NULL, category TEXT, description TEXT, duration_minutes INT,
  price NUMERIC(10,2), target_group TEXT, device_or_method TEXT,
  show_on_website BOOLEAN DEFAULT true, show_on_flyer BOOLEAN DEFAULT true, show_on_social_media BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_treatments TO authenticated;
GRANT ALL ON public.media_package_treatments TO service_role;
ALTER TABLE public.media_package_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mptreat_read" ON public.media_package_treatments FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mptreat_write" ON public.media_package_treatments FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mptreat_touch BEFORE UPDATE ON public.media_package_treatments FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- TEAM
CREATE TABLE IF NOT EXISTS public.media_package_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  first_name TEXT, last_name TEXT, role TEXT, biography TEXT, qualifications TEXT, treatments TEXT,
  profile_file_id UUID,
  show_on_website BOOLEAN DEFAULT true, show_on_flyer BOOLEAN DEFAULT true, show_on_social_media BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_team_members TO authenticated;
GRANT ALL ON public.media_package_team_members TO service_role;
ALTER TABLE public.media_package_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpteam_read" ON public.media_package_team_members FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpteam_write" ON public.media_package_team_members FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpteam_touch BEFORE UPDATE ON public.media_package_team_members FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- BRANDING
CREATE TABLE IF NOT EXISTS public.media_package_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL UNIQUE REFERENCES public.media_packages(id) ON DELETE CASCADE,
  about_me TEXT, studio_description TEXT, company_philosophy TEXT,
  qualifications TEXT, certificates TEXT, professional_experience TEXT, languages TEXT, focus_areas TEXT,
  team_intro TEXT, preferred_salutation TEXT, preferred_writing_style TEXT, preferred_tone TEXT,
  preferred_colors TEXT, excluded_colors TEXT, preferred_styles TEXT[], preferred_fonts TEXT,
  corporate_design_notes TEXT, slogan TEXT, claims TEXT,
  website_examples_positive TEXT, website_examples_negative TEXT,
  visual_language TEXT, target_group TEXT, target_age_group TEXT, regional_focus TEXT,
  unique_selling_points TEXT, main_message TEXT, legally_reviewed_claims BOOLEAN, other_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_branding TO authenticated;
GRANT ALL ON public.media_package_branding TO service_role;
ALTER TABLE public.media_package_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpbrand_read" ON public.media_package_branding FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpbrand_write" ON public.media_package_branding FOR ALL TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE TRIGGER trg_mpbrand_touch BEFORE UPDATE ON public.media_package_branding FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- FILES
CREATE TABLE IF NOT EXISTS public.media_package_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL, scope TEXT,
  original_filename TEXT NOT NULL, storage_path TEXT NOT NULL,
  mime_type TEXT, file_size BIGINT, version INT DEFAULT 1,
  description TEXT, internal_note TEXT, approval_status TEXT DEFAULT 'pending',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mpfiles_mp ON public.media_package_files(media_package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_files TO authenticated;
GRANT ALL ON public.media_package_files TO service_role;
ALTER TABLE public.media_package_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpfiles_read" ON public.media_package_files FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpfiles_write" ON public.media_package_files FOR INSERT TO authenticated WITH CHECK (public.can_write_media_package(media_package_id));
CREATE POLICY "mpfiles_update" ON public.media_package_files FOR UPDATE TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE POLICY "mpfiles_delete" ON public.media_package_files FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_mpfiles_touch BEFORE UPDATE ON public.media_package_files FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

ALTER TABLE public.media_package_team_members
  ADD CONSTRAINT fk_mpteam_profile_file
  FOREIGN KEY (profile_file_id) REFERENCES public.media_package_files(id) ON DELETE SET NULL;

-- CONSENTS
CREATE TABLE IF NOT EXISTS public.media_package_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, accepted BOOLEAN NOT NULL DEFAULT false,
  consent_text_version TEXT, accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mpconsents_mp ON public.media_package_consents(media_package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_consents TO authenticated;
GRANT ALL ON public.media_package_consents TO service_role;
ALTER TABLE public.media_package_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpconsent_read" ON public.media_package_consents FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpconsent_write" ON public.media_package_consents FOR INSERT TO authenticated WITH CHECK (public.can_write_media_package(media_package_id));
CREATE POLICY "mpconsent_delete" ON public.media_package_consents FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- HISTORY
CREATE TABLE IF NOT EXISTS public.media_package_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, entity TEXT, entity_id UUID,
  field_name TEXT, old_value JSONB, new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mphist_mp ON public.media_package_history(media_package_id);
GRANT SELECT, INSERT ON public.media_package_history TO authenticated;
GRANT ALL ON public.media_package_history TO service_role;
ALTER TABLE public.media_package_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mphist_read" ON public.media_package_history FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mphist_write" ON public.media_package_history FOR INSERT TO authenticated WITH CHECK (public.can_read_media_packages());

-- COMMENTS
CREATE TABLE IF NOT EXISTS public.media_package_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL DEFAULT 'staff',
  recipient_type TEXT NOT NULL DEFAULT 'customer',
  subject TEXT, comment TEXT NOT NULL,
  internal_only BOOLEAN DEFAULT false, related_field TEXT,
  attachment_id UUID REFERENCES public.media_package_files(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ, answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mpcomments_mp ON public.media_package_comments(media_package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_package_comments TO authenticated;
GRANT ALL ON public.media_package_comments TO service_role;
ALTER TABLE public.media_package_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpcomm_read" ON public.media_package_comments FOR SELECT TO authenticated USING (public.can_access_media_package(media_package_id));
CREATE POLICY "mpcomm_write" ON public.media_package_comments FOR INSERT TO authenticated WITH CHECK (public.can_write_media_package(media_package_id));
CREATE POLICY "mpcomm_update" ON public.media_package_comments FOR UPDATE TO authenticated USING (public.can_write_media_package(media_package_id)) WITH CHECK (public.can_write_media_package(media_package_id));
CREATE POLICY "mpcomm_delete" ON public.media_package_comments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_mpcomments_touch BEFORE UPDATE ON public.media_package_comments FOR EACH ROW EXECUTE FUNCTION public.mp_touch_updated_at();

-- PROGRESS
CREATE OR REPLACE FUNCTION public.calc_media_package_progress(_mp_id UUID)
RETURNS INT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE score INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.media_package_services WHERE media_package_id = _mp_id AND selected = true) THEN score := score + 10; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_studio_data WHERE media_package_id = _mp_id AND studio_name IS NOT NULL AND studio_name <> '') THEN score := score + 15; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_devices WHERE media_package_id = _mp_id) THEN score := score + 10; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_prices WHERE media_package_id = _mp_id)
     OR EXISTS (SELECT 1 FROM public.media_package_files WHERE media_package_id = _mp_id AND category = 'Preisliste') THEN score := score + 15; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_contact_data WHERE media_package_id = _mp_id AND email IS NOT NULL AND email <> '') THEN score := score + 10; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_opening_hours WHERE media_package_id = _mp_id) THEN score := score + 5; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_treatments WHERE media_package_id = _mp_id) THEN score := score + 5; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_branding WHERE media_package_id = _mp_id AND (about_me IS NOT NULL OR team_intro IS NOT NULL)) THEN score := score + 10; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_team_members WHERE media_package_id = _mp_id) THEN score := score + 5; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_files WHERE media_package_id = _mp_id AND category = 'Logo') THEN score := score + 5; END IF;
  IF EXISTS (SELECT 1 FROM public.media_package_consents WHERE media_package_id = _mp_id AND accepted = true) THEN score := score + 10; END IF;
  RETURN LEAST(score, 100);
END; $$;

-- STORAGE POLICIES (bucket already created)
CREATE POLICY "mp_storage_read_staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mediapaket-files' AND public.can_read_media_packages());
CREATE POLICY "mp_storage_write_staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mediapaket-files' AND public.can_manage_media_packages());
CREATE POLICY "mp_storage_update_staff" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mediapaket-files' AND public.can_manage_media_packages())
  WITH CHECK (bucket_id = 'mediapaket-files' AND public.can_manage_media_packages());
CREATE POLICY "mp_storage_delete_super_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mediapaket-files' AND public.has_role('Super Admin'));
