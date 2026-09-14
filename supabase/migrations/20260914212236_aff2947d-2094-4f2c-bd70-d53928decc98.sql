
-- ============================================================
-- A) SYNC-KONFLIKTE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gobd_sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  invoice_number text,
  tenant_id uuid,
  source text NOT NULL DEFAULT 'zoho',
  zoho_reference text,
  field text NOT NULL,
  local_value text,
  external_value text,
  status text NOT NULL DEFAULT 'OFFEN',
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gobd_sync_conflicts_status_chk
    CHECK (status IN ('OFFEN','GEPRUEFT','IGNORIERT','KORREKTUR_ERFORDERLICH'))
);

GRANT SELECT, UPDATE ON public.gobd_sync_conflicts TO authenticated;
GRANT ALL ON public.gobd_sync_conflicts TO service_role;
ALTER TABLE public.gobd_sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gobd_conf_select ON public.gobd_sync_conflicts;
CREATE POLICY gobd_conf_select ON public.gobd_sync_conflicts FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin')
       OR has_role('Buchhaltung EU') OR has_role('Buchhaltung CH') OR has_role('Finance')
       OR has_role('Read Only Audit'));

DROP POLICY IF EXISTS gobd_conf_update ON public.gobd_sync_conflicts;
CREATE POLICY gobd_conf_update ON public.gobd_sync_conflicts FOR UPDATE TO authenticated
USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin'))
WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin'));

CREATE INDEX IF NOT EXISTS idx_gobd_conf_status ON public.gobd_sync_conflicts(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_gobd_conf_invoice ON public.gobd_sync_conflicts(invoice_id);

DROP TRIGGER IF EXISTS trg_gobd_conf_touch ON public.gobd_sync_conflicts;
CREATE TRIGGER trg_gobd_conf_touch BEFORE UPDATE ON public.gobd_sync_conflicts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- B) EXPORT-PROTOKOLL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gobd_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  accounting_region text,
  export_type text NOT NULL,
  period_from date,
  period_to date,
  record_count integer,
  file_name text,
  file_hash text,
  status text NOT NULL DEFAULT 'CREATED',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gobd_export_log TO authenticated;
GRANT ALL ON public.gobd_export_log TO service_role;
ALTER TABLE public.gobd_export_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gobd_exp_select ON public.gobd_export_log;
CREATE POLICY gobd_exp_select ON public.gobd_export_log FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin')
       OR has_role('Buchhaltung EU') OR has_role('Buchhaltung CH') OR has_role('Finance')
       OR has_role('Read Only Audit'));

DROP POLICY IF EXISTS gobd_exp_block_update ON public.gobd_export_log;
CREATE POLICY gobd_exp_block_update ON public.gobd_export_log FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gobd_exp_block_delete ON public.gobd_export_log;
CREATE POLICY gobd_exp_block_delete ON public.gobd_export_log FOR DELETE TO authenticated, anon USING (false);

CREATE OR REPLACE FUNCTION public.gobd_log_export(
  _export_type text,
  _period_from date DEFAULT NULL,
  _period_to date DEFAULT NULL,
  _record_count integer DEFAULT NULL,
  _file_name text DEFAULT NULL,
  _file_hash text DEFAULT NULL,
  _status text DEFAULT 'CREATED',
  _accounting_region text DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.gobd_export_log(tenant_id, accounting_region, export_type, period_from, period_to,
    record_count, file_name, file_hash, status, metadata, created_by)
  VALUES (_tenant_id, _accounting_region, _export_type, _period_from, _period_to,
    _record_count, _file_name, _file_hash, coalesce(_status,'CREATED'), coalesce(_metadata,'{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(user_id, action, module, record_id, details)
  VALUES (auth.uid(),
          CASE upper(coalesce(_status,'CREATED'))
            WHEN 'DOWNLOADED' THEN 'EXPORT_DOWNLOADED'
            WHEN 'FAILED' THEN 'EXPORT_FAILED'
            ELSE 'EXPORT_CREATED' END,
          'gobd_export', v_id::text,
          jsonb_build_object('export_type', _export_type, 'period_from', _period_from,
            'period_to', _period_to, 'record_count', _record_count, 'file_name', _file_name,
            'file_hash', _file_hash, 'region', _accounting_region));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gobd_log_export(text,date,date,integer,text,text,text,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_log_export(text,date,date,integer,text,text,text,text,uuid,jsonb) TO authenticated, service_role;

-- ============================================================
-- C) ZOHO-SPERRE IM RECHNUNGS-GUARD
-- ============================================================
CREATE OR REPLACE FUNCTION public.gobd_invoice_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_service boolean := public.gobd_is_service_context();
  v_final boolean;
  v_changed text[] := '{}';
  v_locked boolean;
  v_patch jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_ref text;
  f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.invoice_date IS NOT NULL AND NOT v_service
       AND public.gobd_period_state(NEW.accounting_region, NEW.invoice_date) = 'hard_locked' THEN
      RAISE EXCEPTION 'GoBD: Periode % (%) ist hart gesperrt. Keine neue Rechnung in dieser Periode.',
        to_char(NEW.invoice_date, 'YYYY-MM'), NEW.accounting_region;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF public.gobd_invoice_is_final(OLD.status) THEN
      RAISE EXCEPTION 'GoBD: Finalisierte Rechnung % darf nicht geloescht werden. Bitte Storno/Gutschrift verwenden.',
        coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text);
    END IF;
    RETURN OLD;
  END IF;

  v_final := public.gobd_invoice_is_final(OLD.status);
  IF NOT v_final THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH f IN ARRAY ARRAY['invoice_number','legal_invoice_number','beleg_id','invoice_date',
                           'customer_id','customer_name','billing_address','city','currency',
                           'total','due_date','raw_data','accounting_region','is_deposit',
                           'reference_number'] LOOP
    IF v_new -> f IS DISTINCT FROM v_old -> f THEN
      v_changed := v_changed || f;
    END IF;
  END LOOP;

  IF NOT public.gobd_invoice_is_final(NEW.status) THEN
    v_changed := v_changed || 'status (final -> Entwurf)';
  END IF;

  v_locked := OLD.invoice_date IS NOT NULL
              AND public.gobd_period_state(OLD.accounting_region, OLD.invoice_date) = 'hard_locked';

  IF v_locked AND NOT v_service AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed := v_changed || 'status (gesperrte Periode)';
  END IF;

  IF array_length(v_changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Service-/Importkontext (Zoho, Hintergrundjobs): steuerlich relevante Werte werden
  -- NICHT uebernommen, sondern verworfen und als Synchronisationskonflikt gemeldet.
  IF v_service THEN
    v_ref := coalesce(v_new ->> 'zoho_invoice_id', v_old ->> 'zoho_invoice_id',
                      v_new ->> 'source_system', v_old ->> 'source_system');

    FOREACH f IN ARRAY v_changed LOOP
      IF f NOT IN ('invoice_number','legal_invoice_number','beleg_id','invoice_date',
                   'customer_id','customer_name','billing_address','city','currency',
                   'total','due_date','raw_data','accounting_region','is_deposit',
                   'reference_number') THEN
        CONTINUE;
      END IF;
      v_patch := v_patch || jsonb_build_object(f, v_old -> f);

      IF NOT EXISTS (
        SELECT 1 FROM public.gobd_sync_conflicts c
        WHERE c.invoice_id = OLD.id AND c.field = f AND c.status = 'OFFEN'
          AND coalesce(c.external_value,'') = coalesce(left(v_new ->> f, 4000),'')
      ) THEN
        INSERT INTO public.gobd_sync_conflicts(invoice_id, invoice_number, tenant_id, source,
          zoho_reference, field, local_value, external_value)
        VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id,
          'zoho', v_ref, f, left(v_old ->> f, 4000), left(v_new ->> f, 4000));
      END IF;
    END LOOP;

    -- Rueckfall auf Entwurf durch Import ebenfalls verhindern
    IF NOT public.gobd_invoice_is_final(NEW.status) THEN
      v_patch := v_patch || jsonb_build_object('status', v_old -> 'status');
      INSERT INTO public.gobd_sync_conflicts(invoice_id, invoice_number, tenant_id, source,
        zoho_reference, field, local_value, external_value)
      VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id,
        'zoho', v_ref, 'status', v_old ->> 'status', v_new ->> 'status');
    END IF;

    IF v_patch <> '{}'::jsonb THEN
      NEW := jsonb_populate_record(NEW, v_patch);
      INSERT INTO public.invoice_audit_log(invoice_id, invoice_number, tenant_id, user_id, action, fields, metadata)
      VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id, auth.uid(),
              'ZOHO_SYNC_CONFLICT', ARRAY(SELECT jsonb_object_keys(v_patch)),
              jsonb_build_object('source','service','zoho_reference', v_ref));
    END IF;
    RETURN NEW;
  END IF;

  IF v_locked THEN
    RAISE EXCEPTION 'GoBD: Periode % ist hart gesperrt. Aenderung der Rechnung % abgewiesen (Felder: %).',
      to_char(OLD.invoice_date, 'YYYY-MM'),
      coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text),
      array_to_string(v_changed, ', ');
  END IF;

  RAISE EXCEPTION 'GoBD: Rechnung % ist finalisiert. Gesperrte Felder: %. Korrektur nur per Storno/Gutschrift/Berichtigung.',
    coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text),
    array_to_string(v_changed, ', ');
END;
$function$;

-- ============================================================
-- D) AUDIT-PROTOKOLLE MANIPULATIONSSICHER
-- ============================================================
REVOKE UPDATE, DELETE ON public.invoice_audit_log FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.invoice_corrections FROM authenticated, anon;

DROP POLICY IF EXISTS inv_audit_block_update ON public.invoice_audit_log;
CREATE POLICY inv_audit_block_update ON public.invoice_audit_log FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS inv_audit_block_delete ON public.invoice_audit_log;
CREATE POLICY inv_audit_block_delete ON public.invoice_audit_log FOR DELETE TO authenticated, anon USING (false);

DROP POLICY IF EXISTS inv_corr_block_update ON public.invoice_corrections;
CREATE POLICY inv_corr_block_update ON public.invoice_corrections FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS inv_corr_block_delete ON public.invoice_corrections;
CREATE POLICY inv_corr_block_delete ON public.invoice_corrections FOR DELETE TO authenticated, anon USING (false);

-- erweiterte Ereignisliste
CREATE OR REPLACE FUNCTION public.gobd_log_invoice_event(_invoice_id uuid, _action text, _reason text DEFAULT NULL::text,
  _related_invoice_id uuid DEFAULT NULL::uuid, _fields text[] DEFAULT NULL::text[], _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_num text; v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet.'; END IF;
  IF _action NOT IN ('INVOICE_CREATED','INVOICE_FINALIZED','INVOICE_SENT',
                     'INVOICE_CANCELLED','INVOICE_CANCELLATION_CREATED','INVOICE_CORRECTION_CREATED',
                     'INVOICE_CHANGE_REJECTED','PAYMENT_IMPORTED','PAYMENT_ASSIGNED','PAYMENT_UNASSIGNED',
                     'PAYMENT_REASSIGNED','PAYMENT_REFUNDED','CHARGEBACK_CREATED',
                     'EINVOICE_IMPORTED','EINVOICE_EXPORTED','EINVOICE_VALIDATION_FAILED',
                     'ZOHO_SYNC','ZOHO_SYNC_CONFLICT') THEN
    RAISE EXCEPTION 'Unbekannte Aktion: %', _action;
  END IF;
  SELECT coalesce(legal_invoice_number, invoice_number), tenant_id INTO v_num, v_tenant
  FROM public.zoho_invoices WHERE id = _invoice_id;
  INSERT INTO public.invoice_audit_log(invoice_id, invoice_number, tenant_id, user_id, action, reason,
                                       related_invoice_id, fields, metadata)
  VALUES (_invoice_id, v_num, v_tenant, auth.uid(), _action, _reason, _related_invoice_id, _fields,
          coalesce(_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================
-- E) BACKUP-LOESCHUNG PROTOKOLLIEREN
-- ============================================================
CREATE OR REPLACE FUNCTION public.gobd_backup_delete_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, module, record_id, details)
  VALUES (auth.uid(), 'BACKUP_DELETED', 'backup', OLD.id::text,
          jsonb_build_object('backup_type', OLD.backup_type, 'backup_scope', OLD.backup_scope,
            'backup_status', OLD.backup_status, 'storage_path', OLD.storage_path,
            'started_at', OLD.started_at, 'size_bytes', OLD.backup_size_bytes,
            'result','DELETED'));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_gobd_backup_delete_audit ON public.backups_metadata;
CREATE TRIGGER trg_gobd_backup_delete_audit BEFORE DELETE ON public.backups_metadata
FOR EACH ROW EXECUTE FUNCTION public.gobd_backup_delete_audit();

-- ============================================================
-- F) RECHNUNGSNUMMERNPRUEFUNG (nur lesend)
-- ============================================================
CREATE OR REPLACE FUNCTION public.gobd_invoice_number_check(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(check_type text, severity text, tenant_id uuid, invoice_id uuid, number text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin')
          OR has_role('Buchhaltung EU') OR has_role('Buchhaltung CH') OR has_role('Finance')
          OR has_role('Read Only Audit')) THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer die Rechnungsnummernpruefung.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT i.id, i.tenant_id AS tid, i.legal_invoice_number AS num, i.beleg_id, i.status, i.invoice_date
    FROM public.zoho_invoices i
    WHERE (_tenant_id IS NULL OR i.tenant_id = _tenant_id)
  ),
  numbered AS (
    SELECT * FROM base WHERE num ~ '^[0-9]{4}-[0-9]{2}-[0-9]{4}$'
  ),
  dupes AS (
    SELECT b.tid, b.id, b.num FROM base b
    JOIN (SELECT num AS n, tid AS t FROM base WHERE num IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d
      ON d.n = b.num AND d.t IS NOT DISTINCT FROM b.tid
  ),
  dupe_beleg AS (
    SELECT b.tid, b.id, b.beleg_id FROM base b
    JOIN (SELECT beleg_id AS n, tid AS t FROM base WHERE beleg_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d
      ON d.n = b.beleg_id AND d.t IS NOT DISTINCT FROM b.tid
  ),
  grp AS (
    SELECT left(num, 7) AS prefix, min(right(num,4)::int) AS lo, max(right(num,4)::int) AS hi
    FROM numbered GROUP BY 1
  ),
  gaps AS (
    SELECT g.prefix, s.i AS seq
    FROM grp g CROSS JOIN LATERAL generate_series(g.lo, g.hi) AS s(i)
    WHERE NOT EXISTS (SELECT 1 FROM numbered n WHERE left(n.num,7) = g.prefix AND right(n.num,4)::int = s.i)
  )
  SELECT 'DUPLIKAT'::text, 'FEHLER'::text, d.tid, d.id, d.num,
         'Rechnungsnummer mehrfach vergeben'::text FROM dupes d
  UNION ALL
  SELECT 'DUPLIKAT_BELEG_ID', 'FEHLER', d.tid, d.id, d.beleg_id,
         'Beleg-ID mehrfach vergeben' FROM dupe_beleg d
  UNION ALL
  SELECT 'FORMATFEHLER', 'WARNUNG', b.tid, b.id, b.num,
         'Nummer entspricht nicht dem Format JJJJ-MM-NNNN'
  FROM base b WHERE b.num IS NOT NULL AND b.num !~ '^[0-9]{4}-[0-9]{2}-[0-9]{4}$'
  UNION ALL
  SELECT 'OHNE_NUMMER', 'FEHLER', b.tid, b.id, b.beleg_id,
         'Finalisierte Rechnung ohne Rechnungsnummer'
  FROM base b WHERE b.num IS NULL AND public.gobd_invoice_is_final(b.status)
  UNION ALL
  SELECT 'LUECKE', 'WARNUNG', NULL::uuid, NULL::uuid,
         g.prefix || '-' || lpad(g.seq::text, 4, '0'),
         'Nummer innerhalb der verwendeten Sequenz nicht vergeben'
  FROM gaps g
  UNION ALL
  SELECT 'NUMMER_GEAENDERT', 'WARNUNG', NULL::uuid, a.invoice_id, a.new_number,
         'Nachtraegliche Nummernaenderung von ' || coalesce(a.old_number,'—') || ' (' || a.action || ')'
  FROM public.invoice_number_audit a
  WHERE a.action ILIKE '%correct%' OR a.action ILIKE '%change%' OR a.action ILIKE '%aender%'
  UNION ALL
  SELECT 'NUMMER_OHNE_RECHNUNG', 'WARNUNG', NULL::uuid, a.invoice_id, a.new_number,
         'Protokollierte Nummer ohne zugehoerige Rechnung'
  FROM public.invoice_number_audit a
  WHERE a.invoice_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.zoho_invoices i WHERE i.id = a.invoice_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gobd_invoice_number_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_invoice_number_check(uuid) TO authenticated, service_role;

-- ============================================================
-- G) ZENTRALE AUDIT-ANSICHT (lesend, keine Parallelspeicherung)
-- ============================================================
CREATE OR REPLACE VIEW public.gobd_audit_unified
WITH (security_invoker = on) AS
  SELECT l.id, l.created_at AS ts, l.user_id, l.action, l.module AS source,
         'audit_logs'::text AS origin, NULL::uuid AS tenant_id,
         coalesce(l.module,'system') AS object_type, l.record_id AS object_id,
         NULL::text AS reason, l.details AS metadata
  FROM public.audit_logs l
  UNION ALL
  SELECT a.id, a.created_at, a.user_id, a.action, 'invoice', 'invoice_audit_log',
         a.tenant_id, 'invoice', a.invoice_id::text, a.reason, a.metadata
  FROM public.invoice_audit_log a
  UNION ALL
  SELECT t.id, t.created_at, t.user_id, t.action, t.module, 'finance_audit_trail',
         NULL::uuid, t.entity_table, t.entity_id::text, NULL,
         jsonb_build_object('old', t.old_data, 'new', t.new_data, 'region', t.accounting_region)
  FROM public.finance_audit_trail t
  UNION ALL
  SELECT n.id, n.created_at, n.actor, 'INVOICE_NUMBER_' || upper(n.action), 'invoice_number',
         'invoice_number_audit', NULL::uuid, 'invoice', n.invoice_id::text, n.reason,
         jsonb_build_object('old_number', n.old_number, 'new_number', n.new_number, 'actor_email', n.actor_email)
  FROM public.invoice_number_audit n
  UNION ALL
  SELECT e.id, e.created_at, e.created_by,
         CASE e.status WHEN 'FAILED' THEN 'EXPORT_FAILED' WHEN 'DOWNLOADED' THEN 'EXPORT_DOWNLOADED' ELSE 'EXPORT_CREATED' END,
         e.export_type, 'gobd_export_log', e.tenant_id, 'export', e.id::text, NULL,
         jsonb_build_object('period_from', e.period_from, 'period_to', e.period_to,
           'record_count', e.record_count, 'file_name', e.file_name, 'file_hash', e.file_hash)
  FROM public.gobd_export_log e
  UNION ALL
  SELECT c.id, c.detected_at, NULL::uuid, 'ZOHO_SYNC_CONFLICT', c.source, 'gobd_sync_conflicts',
         c.tenant_id, 'invoice', c.invoice_id::text, c.resolution,
         jsonb_build_object('field', c.field, 'local', c.local_value, 'external', c.external_value, 'status', c.status)
  FROM public.gobd_sync_conflicts c;

GRANT SELECT ON public.gobd_audit_unified TO authenticated;
