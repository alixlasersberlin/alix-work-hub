
-- =====================================================================
-- BUG & CAPA MODULE (additive – touches no existing tables)
-- =====================================================================

-- 1) NEW ROLE "QM" (idempotent insert in existing roles table)
INSERT INTO public.roles (name, description)
SELECT 'QM', 'Qualitätsmanagement – Bug & CAPA Modul'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'QM');

-- 2) HELPER FUNCTION – darf QM-Modul nutzen?
CREATE OR REPLACE FUNCTION public.can_access_qm()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.has_role('QM');
$$;

-- 3) SEQUENCES für automatische Nummerierung
CREATE SEQUENCE IF NOT EXISTS public.bug_ticket_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.capa_ticket_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.audit_finding_seq START 1;

-- 4) BUGS
CREATE TABLE public.bugs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     text UNIQUE,
  title             text NOT NULL,
  description       text,
  product           text,
  module            text,
  software_version  text,
  priority          text NOT NULL DEFAULT 'normal',     -- niedrig|normal|hoch|dringend
  criticality       text NOT NULL DEFAULT 'mittel',     -- niedrig|mittel|hoch|kritisch
  status            text NOT NULL DEFAULT 'neu',        -- neu|analyse|in_bearbeitung|test|erledigt|geschlossen
  assignee_id       uuid,
  reporter_id       uuid NOT NULL,
  due_date          date,
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bugs TO authenticated;
GRANT ALL ON public.bugs TO service_role;
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm read bugs"   ON public.bugs FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "qm insert bugs" ON public.bugs FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "qm update bugs" ON public.bugs FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "super admin delete bugs" ON public.bugs FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.assign_bug_ticket_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR length(trim(NEW.ticket_number)) = 0 THEN
    NEW.ticket_number := 'BUG-' || LPAD(nextval('public.bug_ticket_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bugs_assign_number BEFORE INSERT ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.assign_bug_ticket_number();
CREATE TRIGGER trg_bugs_updated_at BEFORE UPDATE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bugs_updated_by BEFORE UPDATE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();
CREATE TRIGGER trg_bugs_audit AFTER INSERT OR UPDATE OR DELETE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE INDEX idx_bugs_status   ON public.bugs(status);
CREATE INDEX idx_bugs_assignee ON public.bugs(assignee_id);

-- 5) CAPAs
CREATE TABLE public.capas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_number         text UNIQUE,
  title               text NOT NULL,
  trigger_type        text NOT NULL DEFAULT 'sonstiges', -- bug|reklamation|audit|sonstiges
  bug_id              uuid REFERENCES public.bugs(id) ON DELETE SET NULL,
  production_order_id uuid,                              -- Verweis auf production_orders (Reklamation)
  audit_finding_id    uuid,                              -- FK später ergänzt
  root_cause          text,
  immediate_action    text,
  corrective_action   text,
  preventive_action   text,
  responsible_id      uuid,
  due_date            date,
  effectiveness_check text,
  effectiveness_ok    boolean,
  closure_approved_by uuid,
  closure_approved_at timestamptz,
  status              text NOT NULL DEFAULT 'offen',
  -- offen|bewertung|ursachenanalyse|massnahmenplanung|umsetzung|wirksamkeitspruefung|freigabe|geschlossen
  created_by          uuid,
  updated_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capas TO authenticated;
GRANT ALL ON public.capas TO service_role;
ALTER TABLE public.capas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm read capas"   ON public.capas FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "qm insert capas" ON public.capas FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "qm update capas" ON public.capas FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "super admin delete capas" ON public.capas FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.assign_capa_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.capa_number IS NULL OR length(trim(NEW.capa_number)) = 0 THEN
    NEW.capa_number := 'CAPA-' || LPAD(nextval('public.capa_ticket_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_capas_assign_number BEFORE INSERT ON public.capas
  FOR EACH ROW EXECUTE FUNCTION public.assign_capa_number();
CREATE TRIGGER trg_capas_updated_at BEFORE UPDATE ON public.capas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_capas_updated_by BEFORE UPDATE ON public.capas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();
CREATE TRIGGER trg_capas_audit AFTER INSERT OR UPDATE OR DELETE ON public.capas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE INDEX idx_capas_status      ON public.capas(status);
CREATE INDEX idx_capas_responsible ON public.capas(responsible_id);

-- 6) AUDIT FINDINGS
CREATE TABLE public.audit_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_number  text UNIQUE,
  audit_name      text NOT NULL,
  audit_date      date,
  auditor         text,
  area            text,
  finding_type    text NOT NULL DEFAULT 'beobachtung', -- beobachtung|abweichung_minor|abweichung_major|kritisch
  description     text NOT NULL,
  reference       text,
  capa_id         uuid REFERENCES public.capas(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'offen',      -- offen|in_bearbeitung|geschlossen
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm read audit findings"   ON public.audit_findings FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "qm insert audit findings" ON public.audit_findings FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "qm update audit findings" ON public.audit_findings FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "super admin delete audit findings" ON public.audit_findings FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.assign_audit_finding_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.finding_number IS NULL OR length(trim(NEW.finding_number)) = 0 THEN
    NEW.finding_number := 'AUDIT-' || LPAD(nextval('public.audit_finding_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_findings_assign_number BEFORE INSERT ON public.audit_findings
  FOR EACH ROW EXECUTE FUNCTION public.assign_audit_finding_number();
CREATE TRIGGER trg_audit_findings_updated_at BEFORE UPDATE ON public.audit_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_findings_updated_by BEFORE UPDATE ON public.audit_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();
CREATE TRIGGER trg_audit_findings_audit AFTER INSERT OR UPDATE OR DELETE ON public.audit_findings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- nachträglich FK von capas.audit_finding_id setzen
ALTER TABLE public.capas
  ADD CONSTRAINT capas_audit_finding_fk
  FOREIGN KEY (audit_finding_id) REFERENCES public.audit_findings(id) ON DELETE SET NULL;

-- 7) CAPA ACTIONS (zentrale Maßnahmenliste)
CREATE TABLE public.capa_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id         uuid REFERENCES public.capas(id) ON DELETE CASCADE,
  bug_id          uuid REFERENCES public.bugs(id) ON DELETE SET NULL,
  audit_finding_id uuid REFERENCES public.audit_findings(id) ON DELETE SET NULL,
  source          text NOT NULL DEFAULT 'capa', -- capa|bug|audit|reklamation
  action_text     text NOT NULL,
  responsible_id  uuid,
  due_date        date,
  status          text NOT NULL DEFAULT 'offen', -- offen|in_bearbeitung|erledigt|verworfen
  evidence_text   text,
  completed_at    date,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_actions TO authenticated;
GRANT ALL ON public.capa_actions TO service_role;
ALTER TABLE public.capa_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm read capa actions"   ON public.capa_actions FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "qm insert capa actions" ON public.capa_actions FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "qm update capa actions" ON public.capa_actions FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "super admin delete capa actions" ON public.capa_actions FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_capa_actions_updated_at BEFORE UPDATE ON public.capa_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_capa_actions_updated_by BEFORE UPDATE ON public.capa_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();
CREATE TRIGGER trg_capa_actions_audit AFTER INSERT OR UPDATE OR DELETE ON public.capa_actions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE INDEX idx_capa_actions_status      ON public.capa_actions(status);
CREATE INDEX idx_capa_actions_responsible ON public.capa_actions(responsible_id);

-- 8) QM COMMENTS (für Bugs & CAPA)
CREATE TABLE public.qm_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,  -- bug|capa|audit_finding|capa_action
  entity_id     uuid NOT NULL,
  comment_text  text NOT NULL,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qm_comments TO authenticated;
GRANT ALL ON public.qm_comments TO service_role;
ALTER TABLE public.qm_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm read comments"   ON public.qm_comments FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "qm insert comments" ON public.qm_comments FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "qm update own comments" ON public.qm_comments FOR UPDATE TO authenticated
  USING ((created_by = auth.uid()) OR public.is_admin())
  WITH CHECK ((created_by = auth.uid()) OR public.is_admin());
CREATE POLICY "super admin delete comments" ON public.qm_comments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_qm_comments_entity ON public.qm_comments(entity_type, entity_id);

-- 9) QM ATTACHMENTS
CREATE TABLE public.qm_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  file_name     text NOT NULL,
  file_path     text NOT NULL,
  file_type     text,
  uploaded_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qm_attachments TO authenticated;
GRANT ALL ON public.qm_attachments TO service_role;
ALTER TABLE public.qm_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm read attachments"   ON public.qm_attachments FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "qm insert attachments" ON public.qm_attachments FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "super admin delete attachments" ON public.qm_attachments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_qm_attachments_entity ON public.qm_attachments(entity_type, entity_id);

-- 10) STORAGE BUCKET (privat)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-capa-attachments', 'bug-capa-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "qm read bug-capa attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bug-capa-attachments' AND public.can_access_qm());
CREATE POLICY "qm upload bug-capa attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bug-capa-attachments' AND public.can_access_qm());
CREATE POLICY "qm update bug-capa attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bug-capa-attachments' AND public.can_access_qm());
CREATE POLICY "super admin delete bug-capa attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bug-capa-attachments' AND public.has_role('Super Admin'));
