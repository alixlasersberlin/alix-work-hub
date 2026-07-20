
ALTER TABLE public.ac_contacts
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ac_contacts_customer ON public.ac_contacts(customer_id);

CREATE TABLE IF NOT EXISTS public.ac_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email','whatsapp','sms')),
  subject TEXT,
  body TEXT NOT NULL,
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','completed','failed','cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_campaigns TO authenticated;
GRANT ALL ON public.ac_campaigns TO service_role;
ALTER TABLE public.ac_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_campaigns_admin_all" ON public.ac_campaigns FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.ac_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ac_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.ac_contacts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_camp_rec_campaign ON public.ac_campaign_recipients(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_campaign_recipients TO authenticated;
GRANT ALL ON public.ac_campaign_recipients TO service_role;
ALTER TABLE public.ac_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_camp_rec_admin_all" ON public.ac_campaign_recipients FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.ac_contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ac_contacts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_notes_contact ON public.ac_contact_notes(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_contact_notes TO authenticated;
GRANT ALL ON public.ac_contact_notes TO service_role;
ALTER TABLE public.ac_contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_notes_internal_read" ON public.ac_contact_notes FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Order'));
CREATE POLICY "ac_notes_internal_write" ON public.ac_contact_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "ac_notes_author_delete" ON public.ac_contact_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.ac_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_ac_campaigns_touch ON public.ac_campaigns;
CREATE TRIGGER trg_ac_campaigns_touch BEFORE UPDATE ON public.ac_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
