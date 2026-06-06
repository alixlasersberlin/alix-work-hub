-- mail_phone_notes
CREATE TABLE IF NOT EXISTS public.mail_phone_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  contact_name text,
  phone_number text,
  call_date date NOT NULL DEFAULT current_date,
  call_time time,
  department text,
  staff_user_id uuid,
  call_type text NOT NULL DEFAULT 'inbound', -- inbound|outbound|callback|complaint|sales|payment|repair|delivery|training
  topic text,
  note text,
  result text,
  has_followup boolean NOT NULL DEFAULT false,
  followup_date date,
  priority text NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
  order_id uuid,
  repair_order_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mpn_customer ON public.mail_phone_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_mpn_date ON public.mail_phone_notes(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_mpn_followup ON public.mail_phone_notes(followup_date) WHERE has_followup = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_phone_notes TO authenticated;
GRANT ALL ON public.mail_phone_notes TO service_role;
ALTER TABLE public.mail_phone_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpn_select" ON public.mail_phone_notes FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mpn_insert" ON public.mail_phone_notes FOR INSERT TO authenticated WITH CHECK (public.can_access_mail() AND NOT public.has_role('Read Only') AND NOT public.has_role('Read Only Audit'));
CREATE POLICY "mpn_update" ON public.mail_phone_notes FOR UPDATE TO authenticated USING (public.can_access_mail() AND NOT public.has_role('Read Only') AND NOT public.has_role('Read Only Audit')) WITH CHECK (public.can_access_mail());
CREATE POLICY "mpn_delete" ON public.mail_phone_notes FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_mpn_updated_at BEFORE UPDATE ON public.mail_phone_notes
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- mail_tasks
CREATE TABLE IF NOT EXISTS public.mail_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  customer_id uuid,
  order_id uuid,
  repair_order_id uuid,
  ticket_id uuid,
  phone_note_id uuid REFERENCES public.mail_phone_notes(id) ON DELETE SET NULL,
  assigned_to uuid,
  department text,
  due_date date,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'offen', -- offen|in_bearbeitung|wartet_kunde|erledigt|abgebrochen
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mt_customer ON public.mail_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_mt_assigned ON public.mail_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_mt_due ON public.mail_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_mt_status ON public.mail_tasks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_tasks TO authenticated;
GRANT ALL ON public.mail_tasks TO service_role;
ALTER TABLE public.mail_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mt_select" ON public.mail_tasks FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mt_insert" ON public.mail_tasks FOR INSERT TO authenticated WITH CHECK (public.can_access_mail() AND NOT public.has_role('Read Only') AND NOT public.has_role('Read Only Audit'));
CREATE POLICY "mt_update" ON public.mail_tasks FOR UPDATE TO authenticated USING (public.can_access_mail() AND NOT public.has_role('Read Only') AND NOT public.has_role('Read Only Audit')) WITH CHECK (public.can_access_mail());
CREATE POLICY "mt_delete" ON public.mail_tasks FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_mt_updated_at BEFORE UPDATE ON public.mail_tasks
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- mail_followups
CREATE TABLE IF NOT EXISTS public.mail_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  customer_id uuid,
  phone_note_id uuid REFERENCES public.mail_phone_notes(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.mail_tasks(id) ON DELETE CASCADE,
  assigned_to uuid,
  department text,
  due_date date NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'offen', -- offen|erledigt|verschoben|abgebrochen
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mf_due ON public.mail_followups(due_date);
CREATE INDEX IF NOT EXISTS idx_mf_assigned ON public.mail_followups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_mf_status ON public.mail_followups(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_followups TO authenticated;
GRANT ALL ON public.mail_followups TO service_role;
ALTER TABLE public.mail_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mf_select" ON public.mail_followups FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mf_insert" ON public.mail_followups FOR INSERT TO authenticated WITH CHECK (public.can_access_mail() AND NOT public.has_role('Read Only') AND NOT public.has_role('Read Only Audit'));
CREATE POLICY "mf_update" ON public.mail_followups FOR UPDATE TO authenticated USING (public.can_access_mail() AND NOT public.has_role('Read Only') AND NOT public.has_role('Read Only Audit')) WITH CHECK (public.can_access_mail());
CREATE POLICY "mf_delete" ON public.mail_followups FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_mf_updated_at BEFORE UPDATE ON public.mail_followups
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();