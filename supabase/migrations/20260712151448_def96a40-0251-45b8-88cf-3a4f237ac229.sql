
-- ============================================================
-- 1) STAMMTABELLEN (ADDITIV, KEIN EINGRIFF IN BESTEHENDES)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  hierarchy_level int NOT NULL DEFAULT 50,
  is_system_role boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_roles TO authenticated;
GRANT ALL ON public.security_roles TO service_role;
ALTER TABLE public.security_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec_roles_read_admin" ON public.security_roles FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sec_roles_manage_super" ON public.security_roles FOR ALL TO authenticated USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.security_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL,
  description text,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_permissions TO authenticated;
GRANT ALL ON public.security_permissions TO service_role;
ALTER TABLE public.security_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec_perm_read_admin" ON public.security_permissions FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sec_perm_manage_super" ON public.security_permissions FOR ALL TO authenticated USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.security_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.security_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.security_permissions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);
GRANT SELECT ON public.security_role_permissions TO authenticated;
GRANT ALL ON public.security_role_permissions TO service_role;
ALTER TABLE public.security_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec_rp_read_admin" ON public.security_role_permissions FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sec_rp_manage_super" ON public.security_role_permissions FOR ALL TO authenticated USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.security_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.security_roles(id) ON DELETE CASCADE,
  tenant_id uuid,
  department_id uuid,
  location_id uuid,
  valid_from timestamptz,
  valid_until timestamptz,
  assigned_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id, tenant_id, department_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_sec_user_roles_user ON public.security_user_roles(user_id);
GRANT SELECT ON public.security_user_roles TO authenticated;
GRANT ALL ON public.security_user_roles TO service_role;
ALTER TABLE public.security_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec_ur_read_self_or_admin" ON public.security_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "sec_ur_manage_super" ON public.security_user_roles FOR ALL TO authenticated
  USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.security_data_classification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text NOT NULL DEFAULT 'public',
  table_name text NOT NULL,
  classification int NOT NULL CHECK (classification BETWEEN 1 AND 4),
  category text,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schema_name, table_name)
);
GRANT SELECT ON public.security_data_classification TO authenticated;
GRANT ALL ON public.security_data_classification TO service_role;
ALTER TABLE public.security_data_classification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec_class_read_admin" ON public.security_data_classification FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sec_class_manage_super" ON public.security_data_classification FOR ALL TO authenticated USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.security_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,           -- rls | policy | storage | secret | tenancy | classification
  target text NOT NULL,             -- z.B. Tabellenname oder Bucket
  severity text NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  title text NOT NULL,
  detail text,
  recommendation text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','in_progress','resolved','accepted_risk')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_find_status ON public.security_audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_sec_find_sev ON public.security_audit_findings(severity);
GRANT SELECT ON public.security_audit_findings TO authenticated;
GRANT ALL ON public.security_audit_findings TO service_role;
ALTER TABLE public.security_audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec_find_read_admin" ON public.security_audit_findings FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sec_find_manage_super" ON public.security_audit_findings FOR ALL TO authenticated USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));

-- ============================================================
-- 2) HELPER: has_permission (LESE-Funktion, ohne Neben­wirkung)
-- Verwendet security_user_roles + security_role_permissions.
-- Solange security_user_roles leer ist, liefert sie false und
-- greift NICHT in bestehende Policies ein.
-- ============================================================
CREATE OR REPLACE FUNCTION public.security_has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.security_user_roles ur
    JOIN public.security_role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
    JOIN public.security_permissions p ON p.id = rp.permission_id AND p.key = _permission_key AND p.is_active
    JOIN public.security_roles r ON r.id = ur.role_id AND r.is_active
    WHERE ur.user_id = _user_id
      AND ur.is_active
      AND (ur.valid_from IS NULL OR ur.valid_from <= now())
      AND (ur.valid_until IS NULL OR ur.valid_until >= now())
  );
$$;
REVOKE ALL ON FUNCTION public.security_has_permission(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.security_has_permission(uuid,text) TO authenticated;

-- ============================================================
-- 3) SEED: SYSTEM-ROLLEN (23 Stück)
-- ============================================================
INSERT INTO public.security_roles(key, name, description, hierarchy_level) VALUES
  ('super_admin',       'Super Administrator',    'Vollzugriff, verwaltet Sicherheit', 100),
  ('management',        'Geschäftsführung',       'Konzernweite Sicht',                 95),
  ('company_admin',     'Mandanten-Administrator','Verwaltet einen Mandanten',          90),
  ('location_manager',  'Standortleitung',        'Verantwortet einen Standort',        80),
  ('department_manager','Abteilungsleitung',      'Verantwortet eine Abteilung',        75),
  ('sales',             'Vertrieb',               'Angebote, Anfragen, CRM',            60),
  ('service_manager',   'Service-Leitung',        'Steuert Service-Abteilung',          70),
  ('service_employee',  'Service-Mitarbeiter',    'Tickets, Nachbearbeitung',           50),
  ('technician',        'Techniker',              'Reparaturen, Wartungen',             50),
  ('delivery',          'Auslieferung',           'Touren, Lieferungen',                45),
  ('training',          'Schulung',               'Academy & Nachweise',                45),
  ('nisv',              'NiSV-Beauftragte',       'NiSV-Nachweise & Fachkunde',         55),
  ('media_package',     'Mediapaket',             'Kunden-Portal & Media',              50),
  ('finance',           'Finanzen',               'Zahlungen, Mahnwesen',               70),
  ('accounting',        'Buchhaltung',            'Buchungen, DATEV',                   60),
  ('warehouse',         'Lager',                  'Lagerbewegungen, Bestand',           45),
  ('purchasing',        'Einkauf',                'Bestellungen, Lieferanten',          55),
  ('human_resources',   'Personal',               'Personal, Verträge',                 65),
  ('partner',           'Partner',                'Externer Partner mit Teilzugriff',   30),
  ('studio',            'Studio',                 'Studio-Kunden-Sicht',                30),
  ('customer',          'Kunde',                  'Kundenportal, eigene Daten',         10),
  ('auditor',           'Prüfer',                 'Audit-Nur-Lesen',                    40),
  ('read_only',         'Nur-Lesen',              'Beobachterrolle',                    20)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 4) SEED: BERECHTIGUNGEN
-- ============================================================
INSERT INTO public.security_permissions(key, module, action, description, risk_level) VALUES
  -- Tickets
  ('tickets.view_own',        'tickets','view_own',        'Eigene Tickets sehen',                     'low'),
  ('tickets.view_department', 'tickets','view_department', 'Tickets der eigenen Abteilung sehen',      'medium'),
  ('tickets.view_all',        'tickets','view_all',        'Alle Tickets sehen',                       'high'),
  ('tickets.create',          'tickets','create',          'Ticket anlegen',                           'low'),
  ('tickets.update',          'tickets','update',          'Ticket bearbeiten',                        'medium'),
  ('tickets.assign',          'tickets','assign',          'Ticket zuweisen',                          'medium'),
  ('tickets.transfer',        'tickets','transfer',        'Ticket in andere Abteilung übergeben',     'medium'),
  ('tickets.close',           'tickets','close',           'Ticket schließen',                         'medium'),
  ('tickets.delete',          'tickets','delete',          'Ticket löschen',                           'critical'),
  -- Kunden
  ('customers.view',          'customers','view',          'Kunden ansehen',                           'medium'),
  ('customers.create',        'customers','create',        'Kunden anlegen',                           'medium'),
  ('customers.update',        'customers','update',        'Kunden bearbeiten',                        'medium'),
  ('customers.export',        'customers','export',        'Kunden-Export (DSGVO-relevant)',           'high'),
  ('customers.delete',        'customers','delete',        'Kunden löschen',                           'critical'),
  -- Finance
  ('finance.view',            'finance','view',            'Finanzdaten ansehen',                      'high'),
  ('finance.create',          'finance','create',          'Buchungen anlegen',                        'high'),
  ('finance.approve',         'finance','approve',         'Buchungen freigeben',                      'critical'),
  ('finance.export',          'finance','export',          'Finanzdaten exportieren',                  'high'),
  -- Dokumente
  ('documents.view',          'documents','view',          'Dokumente ansehen',                        'medium'),
  ('documents.upload',        'documents','upload',        'Dokumente hochladen',                      'medium'),
  ('documents.download',      'documents','download',      'Dokumente herunterladen',                  'medium'),
  ('documents.delete',        'documents','delete',        'Dokumente löschen',                        'high'),
  ('documents.view_sensitive','documents','view_sensitive','Sensible Dokumente (Ausweise, Verträge)',  'critical'),
  -- Users
  ('users.view',              'users','view',              'Benutzer ansehen',                         'medium'),
  ('users.create',            'users','create',            'Benutzer anlegen',                         'high'),
  ('users.update',            'users','update',            'Benutzer bearbeiten',                      'high'),
  ('users.assign_roles',      'users','assign_roles',      'Rollen zuweisen',                          'critical'),
  ('users.disable',           'users','disable',           'Benutzer deaktivieren',                    'high'),
  -- Security
  ('security.view',           'security','view',           'Security-Center ansehen',                  'high'),
  ('security.manage_roles',   'security','manage_roles',   'Rollen verwalten',                         'critical'),
  ('security.manage_permissions','security','manage_permissions','Berechtigungen verwalten',           'critical'),
  ('security.view_audit',     'security','view_audit',     'Audit-Log ansehen',                        'high'),
  ('security.export_audit',   'security','export_audit',   'Audit-Log exportieren',                    'critical'),
  -- Calendar
  ('calendar.view_own',       'calendar','view_own',       'Eigenen Kalender sehen',                   'low'),
  ('calendar.view_department','calendar','view_department','Abteilungskalender sehen',                 'medium'),
  ('calendar.view_all',       'calendar','view_all',       'Alle Kalender sehen',                      'high'),
  ('calendar.create',         'calendar','create',         'Termin anlegen',                           'low'),
  ('calendar.update',         'calendar','update',         'Termin bearbeiten',                        'medium'),
  ('calendar.delete',         'calendar','delete',         'Termin löschen',                           'medium'),
  -- Orders/Repair/Warehouse
  ('orders.view',             'orders','view',             'Aufträge sehen',                           'medium'),
  ('orders.approve',          'orders','approve',          'Aufträge freigeben',                       'high'),
  ('repair.view',             'repair','view',             'Reparaturen sehen',                        'medium'),
  ('repair.update',           'repair','update',           'Reparaturen bearbeiten',                   'medium'),
  ('warehouse.view',          'warehouse','view',          'Lager sehen',                              'medium'),
  ('warehouse.movement',      'warehouse','movement',      'Lagerbewegungen buchen',                   'medium')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5) SEED: DATENKLASSIFIZIERUNG (Kern-Tabellen, restliche folgen später)
-- ============================================================
INSERT INTO public.security_data_classification(table_name, classification, category, notes) VALUES
  -- KLASSE 4 – HOCHSENSIBEL
  ('customer_bank_details', 4, 'bankdaten',       'IBAN/BIC – GDPR + PCI-nah'),
  ('finance_sepa_mandates', 4, 'bankdaten',       'SEPA-Mandate'),
  ('user_mfa_secrets',      4, 'zugangsdaten',    'TOTP-Secrets'),
  ('otp_challenges',        4, 'zugangsdaten',    'Aktive OTP-Codes'),
  ('alix_sign_signatures',  4, 'unterschriften',  'Rechtsverbindliche Signaturen'),
  ('media_package_treatments',4,'gesundheitsdaten','Behandlungsdaten Kunde'),
  ('media_package_consents',  4,'gesundheitsdaten','Einwilligungen'),
  ('login_sessions',        4, 'zugangsdaten',    'Aktive Sessions'),
  -- KLASSE 3 – VERTRAULICH
  ('customers',             3, 'kundendaten',     'Stammdaten'),
  ('customer_communication_log', 3, 'kundendaten', 'Kundenkommunikation'),
  ('customer_notes',        3, 'kundendaten',     'Interne Notizen'),
  ('tickets',               3, 'kundendaten',     'Ticket-Inhalte'),
  ('ticket_messages',       3, 'kundendaten',     'Ticket-Nachrichten'),
  ('ticket_attachments',    3, 'kundendaten',     'Ticket-Anhänge'),
  ('offers',                3, 'geschäftlich',    'Angebote inkl. Preise'),
  ('orders',                3, 'geschäftlich',    'Aufträge'),
  ('order_items',           3, 'geschäftlich',    'Auftragspositionen'),
  ('finance_incoming_invoices', 3, 'finanzen',    'Eingangsrechnungen'),
  ('finance_journal',       3, 'finanzen',        'Journal'),
  ('finance_bank_lines',    3, 'finanzen',        'Bank-Bewegungen'),
  ('repair_orders',         3, 'geschäftlich',    'Reparaturaufträge'),
  ('service_ai_analyses',   3, 'geschäftlich',    'KI-Analysen Service'),
  ('bugs',                  3, 'qm',              'Fehlermeldungen'),
  ('capas',                 3, 'qm',              'CAPAs'),
  -- KLASSE 2 – INTERN
  ('esc_events',            2, 'kalender',        'Termine intern'),
  ('esc_departments',       2, 'stammdaten',      'Abteilungen'),
  ('departments',           2, 'stammdaten',      'Abteilungen'),
  ('ticket_departments',    2, 'stammdaten',      'Ticket-Abteilungen'),
  ('user_profiles',         2, 'stammdaten',      'Mitarbeiter-Profile'),
  ('roles',                 2, 'stammdaten',      'Bestehende Rollen'),
  ('user_roles',            2, 'stammdaten',      'Benutzer-Rollen'),
  -- KLASSE 1 – ÖFFENTLICH
  ('model_manuals',         1, 'öffentlich',      'Öffentliche Handbücher'),
  ('esc_public_bookings',   1, 'öffentlich',      'Öffentliche Buchungsanfragen')
ON CONFLICT (schema_name, table_name) DO NOTHING;

-- ============================================================
-- 6) SEED: FINDINGS AUS DEM INITIALEN SCAN
-- Diese sind Vorschläge zur Prüfung, KEIN Automatik-Fix.
-- ============================================================
INSERT INTO public.security_audit_findings(category, target, severity, title, detail, recommendation) VALUES
  ('policy','public.ticket_departments','medium',
    'SELECT USING (true) für authenticated',
    'Jeder eingeloggte Mitarbeiter sieht alle Ticket-Abteilungen (Metadaten).',
    'Ok für Stammdaten. Belassen, aber dokumentieren.'),
  ('policy','public.ticket_history','high',
    'SELECT USING (true) für authenticated',
    'Historie aller Tickets für jeden eingeloggten Benutzer sichtbar – umgeht die Abteilungs-Scope-Policies auf tickets.',
    'Policy an Ticket-Scope koppeln (z.B. per JOIN auf tickets + can_manage_tickets()).'),
  ('policy','public.ticket_participants','medium',
    'SELECT USING (true) für authenticated',
    'Teilnehmerliste aller Tickets für jeden eingeloggten User sichtbar.',
    'Auf Ticket-Scope einschränken.'),
  ('classification','public.customer_bank_details','info',
    'Klasse 4 markiert',
    'Sensibelste Kategorie – RLS bereits vorhanden, keine Aktion nötig.',
    'Regelmäßig auditieren.'),
  ('storage','buckets','info',
    'Alle 13 Storage-Buckets privat',
    'Keine öffentlichen Buckets vorhanden.',
    'Beibehalten.'),
  ('secret','frontend','info',
    'Kein SERVICE_ROLE_KEY im Frontend gefunden',
    'Scan über src/ und public/ – nur Demo-Werte in seed.ts (maskiert).',
    'Beibehalten. Nur ANON-Key im Client.'),
  ('rls','public','info',
    '305 Tabellen, alle mit RLS + Policy',
    'Keine Tabelle ohne RLS und keine RLS-Tabelle ohne Policy erkannt.',
    'Ausgangslage exzellent. Nächste Phase: Feinschnitt der Policies.')
ON CONFLICT DO NOTHING;

-- Update-Trigger
CREATE OR REPLACE FUNCTION public.security_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_sec_roles_touch ON public.security_roles;
CREATE TRIGGER trg_sec_roles_touch BEFORE UPDATE ON public.security_roles FOR EACH ROW EXECUTE FUNCTION public.security_touch_updated_at();
DROP TRIGGER IF EXISTS trg_sec_rp_touch ON public.security_role_permissions;
CREATE TRIGGER trg_sec_rp_touch BEFORE UPDATE ON public.security_role_permissions FOR EACH ROW EXECUTE FUNCTION public.security_touch_updated_at();
DROP TRIGGER IF EXISTS trg_sec_ur_touch ON public.security_user_roles;
CREATE TRIGGER trg_sec_ur_touch BEFORE UPDATE ON public.security_user_roles FOR EACH ROW EXECUTE FUNCTION public.security_touch_updated_at();
DROP TRIGGER IF EXISTS trg_sec_class_touch ON public.security_data_classification;
CREATE TRIGGER trg_sec_class_touch BEFORE UPDATE ON public.security_data_classification FOR EACH ROW EXECUTE FUNCTION public.security_touch_updated_at();
DROP TRIGGER IF EXISTS trg_sec_find_touch ON public.security_audit_findings;
CREATE TRIGGER trg_sec_find_touch BEFORE UPDATE ON public.security_audit_findings FOR EACH ROW EXECUTE FUNCTION public.security_touch_updated_at();

-- ============================================================
-- 7) SICHERHEITSPRÜFUNGS-VIEW für das Security-Center
-- ============================================================
CREATE OR REPLACE VIEW public.security_table_inventory
WITH (security_invoker=on) AS
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policy_count,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd='r') AS select_policies,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd='a') AS insert_policies,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd='w') AS update_policies,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd='d') AS delete_policies,
  EXISTS(SELECT 1 FROM pg_policy p JOIN pg_roles r ON r.oid=ANY(p.polroles) WHERE p.polrelid=c.oid AND r.rolname='anon') AS anon_access,
  EXISTS(SELECT 1 FROM information_schema.columns col WHERE col.table_schema=n.nspname AND col.table_name=c.relname AND col.column_name='tenant_id') AS has_tenant_id,
  EXISTS(SELECT 1 FROM information_schema.columns col WHERE col.table_schema=n.nspname AND col.table_name=c.relname AND col.column_name='department_id') AS has_department_id,
  EXISTS(SELECT 1 FROM information_schema.columns col WHERE col.table_schema=n.nspname AND col.table_name=c.relname AND col.column_name='user_id') AS has_user_id,
  EXISTS(SELECT 1 FROM information_schema.columns col WHERE col.table_schema=n.nspname AND col.table_name=c.relname AND col.column_name='customer_id') AS has_customer_id,
  cls.classification,
  cls.category AS classification_category
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN public.security_data_classification cls ON cls.schema_name=n.nspname AND cls.table_name=c.relname
WHERE n.nspname='public' AND c.relkind='r';

GRANT SELECT ON public.security_table_inventory TO authenticated;

CREATE OR REPLACE VIEW public.security_policy_details
WITH (security_invoker=on) AS
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  p.polname AS policy_name,
  CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS cmd,
  pg_get_expr(p.polqual, p.polrelid) AS using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
  (SELECT string_agg(rolname, ',') FROM pg_roles WHERE oid = ANY(p.polroles)) AS roles
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public';

GRANT SELECT ON public.security_policy_details TO authenticated;
