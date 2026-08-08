DO $$
DECLARE ws uuid;
        r text[] := ARRAY['Admin','Super Admin','Buchhaltung EU','Buchhaltung CH','Buchhaltung Admin'];
BEGIN
  SELECT id INTO ws FROM public.workspaces WHERE code = 'buchhaltung';
  IF ws IS NULL THEN RETURN; END IF;

  DELETE FROM public.workspace_nav_items
   WHERE workspace_id = ws
     AND (path LIKE '/finance%' OR path LIKE '/finanzierungen%' OR path = '/verkauf/gutschriften' OR path = '/w/buchhaltung');

  UPDATE public.workspace_nav_items SET sort_order = 9000 + sort_order WHERE workspace_id = ws;

  INSERT INTO public.workspace_nav_items (workspace_id, label, path, icon, section, roles, sort_order, is_active) VALUES
  (ws,'Dashboard','/w/buchhaltung','LayoutDashboard','Übersicht',r,10,true),

  (ws,'Dashboard','/finance/dashboard','Banknote','Dashboard',r,100,true),
  (ws,'Finance Cockpit','/finance/cockpit','Banknote','Dashboard',r,110,true),
  (ws,'Controlling-Cockpit','/finance/controlling','Activity','Dashboard',r,120,true),

  (ws,'Offene Anzahlungen','/finance/offene-anzahlungen','Wallet','Anzahlungen',r,200,true),

  (ws,'Rechnungen','/finance/rechnungen','FileText','Rechnungen',r,300,true),
  (ws,'Mietkauf Geräte','/finance/vermietung','Repeat','Rechnungen',r,310,true),
  (ws,'Rechnungsvorschläge (Reparaturen)','/finance/rechnungsvorschlaege','Banknote','Rechnungen',r,320,true),
  (ws,'Offene Posten','/finance/offene-posten','FileText','Rechnungen',r,330,true),
  (ws,'Zahlungen','/finance/zahlungen','Banknote','Rechnungen',r,340,true),
  (ws,'Gutschriften','/verkauf/gutschriften','Undo2','Rechnungen',r,350,true),
  (ws,'Eingangsrechnungen','/finance/eingangsrechnungen','Inbox','Rechnungen',r,360,true),
  (ws,'Belegarchiv','/finance/belege','FileText','Rechnungen',r,370,true),
  (ws,'Procure-to-Pay','/finance/p2p','FileText','Rechnungen',r,380,true),
  (ws,'Bankimport','/finance/bank','Banknote','Rechnungen',r,390,true),
  (ws,'SEPA Lastschriften','/finance/sepa','Banknote','Rechnungen',r,400,true),
  (ws,'Treasury','/finance/treasury','Banknote','Rechnungen',r,410,true),

  (ws,'Wiederkehrende Zahler','/finance/wiederkehrende-zahler','Repeat','Ratenzahler',r,500,true),
  (ws,'Bestandsübersicht','/finance/bestandsuebersicht','Repeat','Ratenzahler',r,510,true),
  (ws,'Prüfung','/finance/vertraege','FileText','Ratenzahler',r,520,true),
  (ws,'Laufende Raten','/finance/raten','ScrollText','Ratenzahler',r,530,true),
  (ws,'Ratenplan synchronisieren','/finance/ratenplan-sync','Repeat','Ratenzahler',r,540,true),
  (ws,'SEPA Mandat','/finance/alix-flex','Banknote','Ratenzahler',r,550,true),
  (ws,'Fremd Leasing – Verfügbare Aufträge','/finanzierungen/leasing-bank','Landmark','Ratenzahler',r,560,true),
  (ws,'Finanzierung beantragen','/finanzierungen/beantragen','Landmark','Ratenzahler',r,570,true),
  (ws,'Anfragen offen','/finanzierungen/anfragen-offen','Landmark','Ratenzahler',r,580,true),
  (ws,'Zusagen Bank','/finanzierungen/zusagen-bank','CheckCircle2','Ratenzahler',r,590,true),
  (ws,'Absagen Bank','/finanzierungen/absagen-bank','Landmark','Ratenzahler',r,600,true),

  (ws,'Mahnwesen','/finance/mahnwesen','AlertTriangle','Mahnungen',r,700,true),

  (ws,'Kassenbuch','/finance/kassenbuch','ScrollText','Kassenbuch & Journal',r,800,true),
  (ws,'Buchungsjournal','/finance/buchungsjournal','ScrollText','Kassenbuch & Journal',r,810,true),
  (ws,'Zahlungsübersicht','/finance/zahlungsuebersicht','Wallet','Kassenbuch & Journal',r,820,true),
  (ws,'Bankbuchungen','/finance/bankbuchungen','Landmark','Kassenbuch & Journal',r,830,true),
  (ws,'Export DATEV','/finance/datev-export','FileDown','Kassenbuch & Journal',r,840,true),
  (ws,'Audit & Revision','/finance/audit-revision','ShieldCheck','Kassenbuch & Journal',r,850,true),
  (ws,'Stammdaten (Kontenrahmen · Perioden)','/finance/stammdaten','Database','Kassenbuch & Journal',r,860,true),

  (ws,'Übersicht','/finance/provision','TrendingUp','Provision Mitarbeiter',r,900,true),
  (ws,'Offene Provisionen','/finance/provision/offene','ClipboardList','Provision Mitarbeiter',r,910,true),
  (ws,'Freizugebende Provisionen','/finance/provision/freizugeben','ClipboardCheck','Provision Mitarbeiter',r,920,true),
  (ws,'Freigegebene Provisionen','/finance/provision/freigegeben','CheckCircle2','Provision Mitarbeiter',r,930,true),
  (ws,'Auszahlungsübersicht','/finance/provision/auszahlungen','Banknote','Provision Mitarbeiter',r,940,true),
  (ws,'Stornierte Provisionen','/finance/provision/stornierte','Undo2','Provision Mitarbeiter',r,950,true),
  (ws,'Provisionsabrechnungen','/finance/provision/abrechnungen','FileText','Provision Mitarbeiter',r,960,true),
  (ws,'Mitarbeiter-Zuordnung','/finance/provision/zuordnung','Users','Provision Mitarbeiter',r,970,true),
  (ws,'Provisionsregeln','/finance/provision/regeln','Database','Provision Mitarbeiter',r,980,true),
  (ws,'Auswertungen','/finance/provision/auswertungen','TrendingUp','Provision Mitarbeiter',r,990,true),
  (ws,'Provisions-Audit','/finance/provision/audit','FileText','Provision Mitarbeiter',r,1000,true),
  (ws,'Einstellungen','/finance/provision/einstellungen','Settings','Provision Mitarbeiter',r,1010,true),

  (ws,'Anwaltsfälle','/finance/anwaltsfaelle','ShieldCheck','Anwaltsfälle',r,1100,true),

  (ws,'Anlagenbuchhaltung','/finance/anlagen','FileText','Statistik',r,1200,true),
  (ws,'AfA-Lauf','/finance/anlagen/afa-lauf','FileText','Statistik',r,1210,true),
  (ws,'Anlagenspiegel & Inventar','/finance/anlagenspiegel','FileText','Statistik',r,1220,true),
  (ws,'BWA','/finance/bwa','TrendingUp','Statistik',r,1230,true),
  (ws,'GuV','/finance/guv','FileText','Statistik',r,1240,true),
  (ws,'Bilanz','/finance/bilanz','FileText','Statistik',r,1250,true),
  (ws,'Jahresabschluss','/finance/jahresabschluss','FileText','Statistik',r,1260,true),
  (ws,'Periodenabschluss & Sperre','/finance/perioden','FileText','Statistik',r,1270,true),
  (ws,'DATEV','/finance/datev','FileDown','Statistik',r,1280,true),
  (ws,'Steuer-Auswertung','/finance/steuer','Receipt','Statistik',r,1290,true),

  (ws,'Kontoauszüge importieren','/finance/kontoauszuege/import','Landmark','Bank & Kontoauszüge',r,1400,true),
  (ws,'Importierte Buchungen','/finance/kontoauszuege/buchungen','Landmark','Bank & Kontoauszüge',r,1410,true),
  (ws,'Offene Zuordnungen','/finance/kontoauszuege/offen','Landmark','Bank & Kontoauszüge',r,1420,true),
  (ws,'Bereits verbuchte Zahlungen','/finance/kontoauszuege/verbucht','Landmark','Bank & Kontoauszüge',r,1430,true),
  (ws,'Importhistorie','/finance/kontoauszuege/historie','Landmark','Bank & Kontoauszüge',r,1440,true),
  (ws,'Rücklastschriftquote','/finance/kontoauszuege/quote','Landmark','Bank & Kontoauszüge',r,1450,true),
  (ws,'Bankkonten','/finance/kontoauszuege/konten','Landmark','Bank & Kontoauszüge',r,1460,true),
  (ws,'Importregeln','/finance/kontoauszuege/regeln','Landmark','Bank & Kontoauszüge',r,1470,true),
  (ws,'DATEV-Export','/finance/kontoauszuege/datev','Landmark','Bank & Kontoauszüge',r,1480,true),
  (ws,'Bank-API / EBICS','/finance/kontoauszuege/bank-api','Landmark','Bank & Kontoauszüge',r,1490,true);
END $$;