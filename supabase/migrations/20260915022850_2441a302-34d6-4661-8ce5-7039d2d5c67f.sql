
-- ============ PHASE 13: Verfahrensdokumentation & Berechtigungskonzept ============
-- rein additiv; keine Änderung an Belegen, Zahlungen, Nummernkreisen, Perioden

CREATE TABLE IF NOT EXISTS public.gobd_procedure_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  section text NOT NULL DEFAULT 'GESAMT',
  content_md text NOT NULL,
  content_hash text,
  status text NOT NULL DEFAULT 'FREIGEGEBEN',
  valid_from date NOT NULL DEFAULT current_date,
  superseded_by uuid REFERENCES public.gobd_procedure_docs(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version, section)
);

CREATE TABLE IF NOT EXISTS public.gobd_permission_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  area text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  enforced_by text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_name, area)
);

CREATE TABLE IF NOT EXISTS public.gobd_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  responsible text NOT NULL,
  area text NOT NULL,
  description text NOT NULL,
  evidence text,
  phase text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gobd_four_eyes_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process text NOT NULL UNIQUE,
  requirement_level text NOT NULL DEFAULT 'EMPFOHLEN',
  rationale text NOT NULL,
  current_state text,
  implementation_status text NOT NULL DEFAULT 'OFFEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---- Grants (keine anon-Rechte) ----
GRANT SELECT, INSERT ON public.gobd_procedure_docs TO authenticated;
GRANT ALL ON public.gobd_procedure_docs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.gobd_permission_matrix TO authenticated;
GRANT ALL ON public.gobd_permission_matrix TO service_role;
GRANT SELECT, INSERT ON public.gobd_change_log TO authenticated;
GRANT ALL ON public.gobd_change_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.gobd_four_eyes_recommendations TO authenticated;
GRANT ALL ON public.gobd_four_eyes_recommendations TO service_role;

ALTER TABLE public.gobd_procedure_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gobd_permission_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gobd_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gobd_four_eyes_recommendations ENABLE ROW LEVEL SECURITY;

-- ---- Policies ----
DROP POLICY IF EXISTS gobd_docs_read ON public.gobd_procedure_docs;
CREATE POLICY gobd_docs_read ON public.gobd_procedure_docs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gobd_docs_insert ON public.gobd_procedure_docs;
CREATE POLICY gobd_docs_insert ON public.gobd_procedure_docs FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin'));

DROP POLICY IF EXISTS gobd_matrix_read ON public.gobd_permission_matrix;
CREATE POLICY gobd_matrix_read ON public.gobd_permission_matrix FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gobd_matrix_write ON public.gobd_permission_matrix;
CREATE POLICY gobd_matrix_write ON public.gobd_permission_matrix FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
DROP POLICY IF EXISTS gobd_matrix_update ON public.gobd_permission_matrix;
CREATE POLICY gobd_matrix_update ON public.gobd_permission_matrix FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

DROP POLICY IF EXISTS gobd_changelog_read ON public.gobd_change_log;
CREATE POLICY gobd_changelog_read ON public.gobd_change_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gobd_changelog_insert ON public.gobd_change_log;
CREATE POLICY gobd_changelog_insert ON public.gobd_change_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin'));

DROP POLICY IF EXISTS gobd_4eyes_read ON public.gobd_four_eyes_recommendations;
CREATE POLICY gobd_4eyes_read ON public.gobd_four_eyes_recommendations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gobd_4eyes_write ON public.gobd_four_eyes_recommendations;
CREATE POLICY gobd_4eyes_write ON public.gobd_four_eyes_recommendations FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
DROP POLICY IF EXISTS gobd_4eyes_update ON public.gobd_four_eyes_recommendations;
CREATE POLICY gobd_4eyes_update ON public.gobd_four_eyes_recommendations FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

-- ---- WORM: Verfahrensdokumentation & Änderungsprotokoll unveränderbar ----
CREATE OR REPLACE FUNCTION public.gobd_doc_worm_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GoBD: Einträge in % können nicht gelöscht werden.', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- nur das Setzen der Nachfolgeversion ist zulässig
    IF TG_TABLE_NAME = 'gobd_procedure_docs'
       AND NEW.version IS NOT DISTINCT FROM OLD.version
       AND NEW.title IS NOT DISTINCT FROM OLD.title
       AND NEW.section IS NOT DISTINCT FROM OLD.section
       AND NEW.content_md IS NOT DISTINCT FROM OLD.content_md
       AND NEW.content_hash IS NOT DISTINCT FROM OLD.content_hash
       AND NEW.valid_from IS NOT DISTINCT FROM OLD.valid_from
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND OLD.superseded_by IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'GoBD: Einträge in % können nicht geändert werden. Bitte neue Version anlegen.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worm_gobd_procedure_docs ON public.gobd_procedure_docs;
CREATE TRIGGER trg_worm_gobd_procedure_docs
  BEFORE UPDATE OR DELETE ON public.gobd_procedure_docs
  FOR EACH ROW EXECUTE FUNCTION public.gobd_doc_worm_guard();

DROP TRIGGER IF EXISTS trg_worm_gobd_change_log ON public.gobd_change_log;
CREATE TRIGGER trg_worm_gobd_change_log
  BEFORE UPDATE OR DELETE ON public.gobd_change_log
  FOR EACH ROW EXECUTE FUNCTION public.gobd_doc_worm_guard();

-- Löschschutz für Matrix und Empfehlungen
CREATE OR REPLACE FUNCTION public.gobd_no_delete_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Einträge in % können nicht gelöscht werden.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_nodel_gobd_permission_matrix ON public.gobd_permission_matrix;
CREATE TRIGGER trg_nodel_gobd_permission_matrix
  BEFORE DELETE ON public.gobd_permission_matrix
  FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete_generic();

DROP TRIGGER IF EXISTS trg_nodel_gobd_four_eyes ON public.gobd_four_eyes_recommendations;
CREATE TRIGGER trg_nodel_gobd_four_eyes
  BEFORE DELETE ON public.gobd_four_eyes_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete_generic();

-- updated_at
CREATE OR REPLACE FUNCTION public.gobd_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_gobd_permission_matrix ON public.gobd_permission_matrix;
CREATE TRIGGER trg_touch_gobd_permission_matrix BEFORE UPDATE ON public.gobd_permission_matrix
  FOR EACH ROW EXECUTE FUNCTION public.gobd_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_gobd_four_eyes ON public.gobd_four_eyes_recommendations;
CREATE TRIGGER trg_touch_gobd_four_eyes BEFORE UPDATE ON public.gobd_four_eyes_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.gobd_touch_updated_at();

-- ---- Phase-13-Prüffunktion ----
CREATE OR REPLACE FUNCTION public.gobd_phase13_check()
RETURNS TABLE (bereich text, pruefung text, status text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_docs int; v_sections int; v_matrix int; v_roles int; v_4eyes int; v_open4 int; v_chg int;
BEGIN
  SELECT count(*) INTO v_docs FROM public.gobd_procedure_docs;
  SELECT count(DISTINCT section) INTO v_sections FROM public.gobd_procedure_docs WHERE superseded_by IS NULL;
  SELECT count(*) INTO v_matrix FROM public.gobd_permission_matrix;
  SELECT count(DISTINCT role_name) INTO v_roles FROM public.gobd_permission_matrix;
  SELECT count(*) INTO v_4eyes FROM public.gobd_four_eyes_recommendations;
  SELECT count(*) INTO v_open4 FROM public.gobd_four_eyes_recommendations WHERE implementation_status <> 'UMGESETZT';
  SELECT count(*) INTO v_chg FROM public.gobd_change_log;

  RETURN QUERY SELECT 'Verfahrensdokumentation'::text, 'Dokumentation vorhanden'::text,
    CASE WHEN v_sections >= 8 THEN 'BESTANDEN' WHEN v_docs > 0 THEN 'WARNUNG' ELSE 'OFFEN' END::text,
    (v_sections || ' aktuelle Abschnitte, ' || v_docs || ' Fassungen insgesamt')::text;

  RETURN QUERY SELECT 'Verfahrensdokumentation'::text, 'Versionen unveränderbar'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relname='gobd_procedure_docs' AND t.tgname='trg_worm_gobd_procedure_docs' AND t.tgenabled='O')
    THEN 'BESTANDEN' ELSE 'FEHLER' END::text, 'Neue Version ersetzt alte Fassung nie'::text;

  RETURN QUERY SELECT 'Berechtigungskonzept'::text, 'Rollenmatrix hinterlegt'::text,
    CASE WHEN v_roles >= 6 THEN 'BESTANDEN' WHEN v_matrix > 0 THEN 'WARNUNG' ELSE 'OFFEN' END::text,
    (v_roles || ' Rollen, ' || v_matrix || ' Einträge')::text;

  RETURN QUERY SELECT 'Berechtigungskonzept'::text, 'Löschen nur Super Admin'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='gobd_block_delete') THEN 'BESTANDEN' ELSE 'FEHLER' END::text,
    'Technisch über Löschschutz und Rollenprüfung durchgesetzt'::text;

  RETURN QUERY SELECT 'Vier-Augen-Prinzip'::text, 'Kritische Vorgänge bewertet'::text,
    CASE WHEN v_4eyes >= 6 THEN 'BESTANDEN' WHEN v_4eyes > 0 THEN 'WARNUNG' ELSE 'OFFEN' END::text,
    (v_4eyes || ' Vorgänge bewertet, davon ' || v_open4 || ' organisatorisch offen')::text;

  RETURN QUERY SELECT 'Vier-Augen-Prinzip'::text, 'Organisatorische Umsetzung'::text,
    CASE WHEN v_4eyes = 0 THEN 'OFFEN' WHEN v_open4 = 0 THEN 'BESTANDEN' ELSE 'OFFEN' END::text,
    'Empfehlungen ausgesprochen, produktive Abläufe bewusst unverändert'::text;

  RETURN QUERY SELECT 'Änderungsmanagement'::text, 'Änderungsprotokoll geführt'::text,
    CASE WHEN v_chg > 0 THEN 'BESTANDEN' ELSE 'OFFEN' END::text,
    (v_chg || ' protokollierte Änderungen an GoBD-Funktionen')::text;

  RETURN QUERY SELECT 'Gesamtbewertung'::text, 'Organisatorischer GoBD-Abschluss'::text, 'OFFEN'::text,
    'Phase 14 Aufbewahrung, Phase 15 Wiederherstellungstest, Phase 16 Betriebsprüfungsexport und Phase 17 Gesamtnachweis stehen aus'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.gobd_phase13_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_phase13_check() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gobd_doc_worm_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gobd_no_delete_generic() FROM PUBLIC, anon;
