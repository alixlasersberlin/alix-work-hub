// CAPA 2.0 – 12-Schritte-Prozess (ISO 13485 / MDR / PMS / Vigilanz / FSCA)
// Reine Logik: Schrittdefinitionen, Pflichtprüfungen, Fortschritt.

export type CapaAny = Record<string, any>;

export type CapaStep = {
  no: number;
  key: string;
  title: string;
  short: string;
};

export const CAPA_STEPS: CapaStep[] = [
  { no: 1, key: 'eingang', title: 'Eingang und Erfassung', short: 'Reklamation' },
  { no: 2, key: 'containment', title: 'Sofortmaßnahmen / Containment', short: 'Sofortmaßnahmen' },
  { no: 3, key: 'vigilanz', title: 'MDR-Vigilanzbewertung', short: 'Vigilanz' },
  { no: 4, key: 'untersuchung', title: 'Technische und regulatorische Untersuchung', short: 'Untersuchung' },
  { no: 5, key: 'umfang', title: 'Nichtkonformität und Umfang', short: 'Umfang' },
  { no: 6, key: 'pms', title: 'PMS- und Trendabgleich', short: 'PMS' },
  { no: 7, key: 'entscheidung', title: 'CAPA-Entscheidung', short: 'CAPA-Entscheidung' },
  { no: 8, key: 'rca', title: 'Root Cause Analysis', short: 'Root Cause' },
  { no: 9, key: 'risiko', title: 'Risikomanagement aktualisieren', short: 'Risiko' },
  { no: 10, key: 'massnahmen', title: 'CAPA-Maßnahmen', short: 'Maßnahmen' },
  { no: 11, key: 'fsca', title: 'Feldmaßnahmen / FSCA', short: 'FSCA' },
  { no: 12, key: 'wirksamkeit', title: 'Wirksamkeitsprüfung', short: 'Wirksamkeit' },
];

export const PRODUCT_SECURED = ['ja', 'nein', 'nicht_moeglich'] as const;
export const YES_NO_UNCLEAR = ['ja', 'nein', 'unklar'] as const;

export const CONTAINMENT_OPTIONS = [
  'Lagerbestand sperren', 'Auslieferungsstopp', 'Charge sperren', 'Quarantäne',
  'Gerät sperren', 'Produkt zurückholen', 'Vertrieb informieren', 'Kunden informieren',
  'Service informieren', 'Produktion informieren', 'QMB informieren', 'Geschäftsführung informieren',
];

export const VIGILANCE_QUESTIONS: { key: string; label: string }[] = [
  { key: 'event', label: 'Gab es ein Ereignis?' },
  { key: 'health_effect', label: 'Gab es tatsächliche gesundheitliche Folgen?' },
  { key: 'could_serious', label: 'Hätte das Ereignis zu schwerwiegenden gesundheitlichen Folgen führen können?' },
  { key: 'causality', label: 'Besteht ein möglicher Kausalzusammenhang mit dem Produkt?' },
  { key: 'death', label: 'Tod?' },
  { key: 'serious_deterioration', label: 'Schwerwiegende Verschlechterung des Gesundheitszustands?' },
  { key: 'public_health', label: 'Schwerwiegende Gefahr für die öffentliche Gesundheit?' },
];

export const VIGILANCE_RESULTS = ['nicht_meldepflichtig', 'weitere_bewertung', 'meldepflichtig'] as const;

export const INVESTIGATION_ITEMS: { key: string; label: string }[] = [
  { key: 'funktionspruefung', label: 'Funktionsprüfung' },
  { key: 'sichtpruefung', label: 'Sichtprüfung' },
  { key: 'softwarepruefung', label: 'Softwareprüfung' },
  { key: 'logfile', label: 'Logfile-Analyse' },
  { key: 'produktionsprotokolle', label: 'Produktionsprotokolle' },
  { key: 'pruefprotokolle', label: 'Prüfprotokolle' },
  { key: 'chargenrueckverfolgung', label: 'Chargenrückverfolgung' },
  { key: 'lieferantendaten', label: 'Lieferantendaten' },
  { key: 'dhr', label: 'Device History Record' },
  { key: 'referenzvergleich', label: 'Referenzproduktvergleich' },
  { key: 'ifu', label: 'Gebrauchsanweisung' },
  { key: 'kennzeichnung', label: 'Kennzeichnung' },
  { key: 'fehlanwendung', label: 'Fehlanwendung' },
  { key: 'ausserhalb_zweck', label: 'Gebrauch außerhalb Zweckbestimmung' },
];

export const INVESTIGATION_STATUS = [
  'nicht_erforderlich', 'offen', 'in_pruefung', 'bestanden', 'abweichung', 'nicht_pruefbar',
] as const;

export const SCOPE_QUESTIONS: { key: string; label: string }[] = [
  { key: 'einzelfall', label: 'Einzelfall?' },
  { key: 'charge', label: 'Charge betroffen?' },
  { key: 'serie', label: 'Serie betroffen?' },
  { key: 'produktionszeitraum', label: 'Produktionszeitraum betroffen?' },
  { key: 'komponente', label: 'Komponente betroffen?' },
  { key: 'softwareversion', label: 'Softwareversion betroffen?' },
  { key: 'lieferantencharge', label: 'Lieferantencharge betroffen?' },
  { key: 'weitere_produkte', label: 'Weitere Produkte betroffen?' },
  { key: 'weitere_reklamationen', label: 'Weitere Reklamationen vorhanden?' },
  { key: 'systemisch', label: 'Systemische Abweichung möglich?' },
];

export const SCOPE_RESULTS = ['einzelfall', 'mehrere_produkte', 'systemische_abweichung', 'unklar'] as const;
export const PMS_RESULTS = ['kein_trend', 'trend_beobachten', 'signifikanter_anstieg', 'trendmeldung_pruefen'] as const;

export const DECISION_FACTORS: { key: string; label: string }[] = [
  { key: 'systemische_ursache', label: 'Systemische Ursache' },
  { key: 'wiederholungsfall', label: 'Wiederholungsfall' },
  { key: 'patientenrisiko', label: 'Patienten-/Anwenderrisiko' },
  { key: 'regulatorisch', label: 'Regulatorische Abweichung' },
  { key: 'weitere_produkte', label: 'Weitere Produkte betroffen' },
  { key: 'prozess', label: 'Prozess betroffen' },
  { key: 'lieferant', label: 'Lieferant betroffen' },
  { key: 'qms', label: 'QMS betroffen' },
];

export const RCA_METHODS = ['5_why', 'ishikawa', 'fta', 'frei'] as const;
export const ISHIKAWA_CATEGORIES = ['Mensch', 'Maschine', 'Material', 'Methode', 'Messung', 'Umgebung', 'Lieferant', 'Software'];
export const ROOT_CAUSE_STATUS = ['bestaetigt', 'vermutet', 'nicht_ermittelbar'] as const;
export const ROOT_CAUSE_KIND = ['produktursache', 'qms_prozessursache', 'beides'] as const;

export const RISK_QUESTIONS: { key: string; label: string }[] = [
  { key: 'bekannt', label: 'War die Gefährdung bereits bekannt?' },
  { key: 'auftreten', label: 'Ist die Auftretenswahrscheinlichkeit noch korrekt?' },
  { key: 'schwere', label: 'Ist die Schadensschwere korrekt?' },
  { key: 'kontrollen_versagt', label: 'Haben Risikokontrollmaßnahmen versagt?' },
  { key: 'fehlanwendung', label: 'Neue vorhersehbare Fehlanwendung?' },
  { key: 'neue_gefaehrdung', label: 'Neue Gefährdung?' },
  { key: 'nutzen_risiko', label: 'Ändert sich das Nutzen-Risiko-Verhältnis?' },
];

export const RISK_DECISIONS = [
  'akte_unveraendert', 'aktualisierung_erforderlich', 'neue_gefahr_erfasst', 'risikokontrolle_aendern',
] as const;

export const ACTION_CATEGORIES = [
  'Designänderung', 'Softwareänderung', 'Prüfverfahren', 'Zusätzliche Endprüfung', 'Lieferantenmaßnahme',
  'Prozessänderung', 'Prozessvalidierung', 'Schulung', 'IFU-Änderung', 'Kennzeichnung',
  'Risikokontrollmaßnahme', 'Produktionsänderung', 'QMS-Änderung',
];

export const ACTION_STATUS_V2 = ['offen', 'in_arbeit', 'blockiert', 'umgesetzt', 'verifiziert'] as const;

export const FSCA_MEASURES = [
  'Rückruf', 'Austausch', 'Softwareupdate', 'Technische Nachrüstung', 'Vor-Ort-Korrektur',
  'Zusätzliche Anwenderinformation', 'Field Safety Notice',
];

export const EFFECTIVENESS_RESULTS = ['wirksam', 'teilweise_wirksam', 'nicht_wirksam', 'noch_nicht_bewertbar'] as const;

export type StepCheck = { no: number; complete: boolean; missing: string[]; skipped?: boolean };

function has(v: any) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function evaluateCapa(capa: CapaAny, actions: CapaAny[] = []): StepCheck[] {
  const checks: StepCheck[] = [];
  const noCapa = capa.capa_required === false;

  // 1
  {
    const m: string[] = [];
    if (!has(capa.description)) m.push('Beschreibung');
    if (!has(capa.received_date)) m.push('Eingangsdatum');
    if (!has(capa.product_name)) m.push('Produktbezeichnung');
    if (!has(capa.product_secured)) m.push('Produkt zur Untersuchung gesichert?');
    if (capa.product_secured && capa.product_secured !== 'ja' && !has(capa.product_secured_reason)) m.push('Begründung zur Produktsicherung');
    checks.push({ no: 1, complete: m.length === 0, missing: m });
  }
  // 2
  {
    const m: string[] = [];
    if (!has(capa.immediate_danger)) m.push('Unmittelbare Gefährdung bewerten');
    if (capa.immediate_danger === 'ja' && !has(capa.containment_actions)) m.push('Mindestens eine Sofortmaßnahme');
    if (!has(capa.correction_text) && !has(capa.immediate_action)) m.push('Correction (unmittelbare Korrektur)');
    checks.push({ no: 2, complete: m.length === 0, missing: m });
  }
  // 3
  {
    const m: string[] = [];
    const ans = capa.vigilance_answers || {};
    const unanswered = VIGILANCE_QUESTIONS.filter(q => !has(ans[q.key]));
    if (unanswered.length) m.push(`${unanswered.length} Vigilanzfragen offen`);
    if (!has(capa.vigilance_result)) m.push('Vigilanzergebnis');
    if (capa.vigilance_result === 'meldepflichtig') {
      if (!has(capa.vigilance_rule_code)) m.push('Fristenkategorie');
      if (!has(capa.vigilance_deadline_date)) m.push('Meldefrist');
    }
    if (capa.vigilance_preliminary && !has(capa.vigilance_approved_by)) m.push('QMB-Freigabe der vorläufigen Bewertung');
    checks.push({ no: 3, complete: m.length === 0, missing: m });
  }
  // 4
  {
    const m: string[] = [];
    const inv = capa.investigation || {};
    for (const it of INVESTIGATION_ITEMS) {
      const row = inv[it.key] || {};
      if (!has(row.status) || row.status === 'offen' || row.status === 'in_pruefung') m.push(it.label);
      else if (row.status === 'nicht_pruefbar' && !has(row.note)) m.push(`${it.label}: Begründung`);
    }
    checks.push({ no: 4, complete: m.length === 0, missing: m });
  }
  // 5
  {
    const m: string[] = [];
    if (!has(capa.scope_result)) m.push('Umfangsergebnis');
    if (capa.scope_result === 'unklar') m.push('Umfang noch unklar – Klärung erforderlich');
    checks.push({ no: 5, complete: m.length === 0, missing: m });
  }
  // 6
  {
    const m: string[] = [];
    if (!has(capa.pms_assessment)) m.push('PMS-/Trendbewertung');
    checks.push({ no: 6, complete: m.length === 0, missing: m });
  }
  // 7
  {
    const m: string[] = [];
    if (capa.capa_required === null || capa.capa_required === undefined) m.push('CAPA-Entscheidung');
    if (noCapa) {
      if (!has(capa.no_capa_reason)) m.push('Begründung der No-CAPA-Decision');
      if (!has(capa.no_capa_risk)) m.push('Risikobewertung der No-CAPA-Decision');
      if (!has(capa.decision_by)) m.push('Entscheider');
    }
    checks.push({ no: 7, complete: m.length === 0, missing: m });
  }
  // 8
  {
    const m: string[] = [];
    if (!noCapa) {
      if (!has(capa.rca_method)) m.push('RCA-Methode');
      if (!has(capa.failure_mode)) m.push('Fehlerbild');
      if (!has(capa.direct_cause)) m.push('Direkte Ursache');
      if (!has(capa.root_cause)) m.push('Root Cause');
      if (!has(capa.root_cause_kind)) m.push('Produkt- oder QMS-/Prozessursache');
      if (!has(capa.root_cause_status)) m.push('Root-Cause-Status');
      if (capa.root_cause_status === 'nicht_ermittelbar' && !has(capa.root_cause_note)) m.push('Begründung nicht ermittelbarer Root Cause');
    }
    checks.push({ no: 8, complete: m.length === 0, missing: m, skipped: noCapa });
  }
  // 9
  {
    const m: string[] = [];
    if (!noCapa) {
      const ans = capa.risk_answers || {};
      const unanswered = RISK_QUESTIONS.filter(q => !has(ans[q.key]));
      if (unanswered.length) m.push(`${unanswered.length} Risikofragen offen`);
      if (!has(capa.risk_decision)) m.push('Entscheidung Risikomanagementakte');
      if (capa.risk_decision && capa.risk_decision !== 'akte_unveraendert' && !has(capa.risk_evidence)) m.push('Nachweis der Aktualisierung');
    }
    checks.push({ no: 9, complete: m.length === 0, missing: m, skipped: noCapa });
  }
  // 10
  {
    const m: string[] = [];
    if (!noCapa) {
      if (actions.length === 0) m.push('Mindestens eine Maßnahme');
      for (const a of actions) {
        const label = a.action_text?.slice(0, 40) ?? 'Maßnahme';
        if (!['umgesetzt', 'verifiziert', 'erledigt'].includes(a.status)) m.push(`${label}: nicht abgeschlossen`);
        if (!has(a.adverse_impact)) m.push(`${label}: Bewertung nachteiliger Auswirkungen`);
        else if (a.adverse_impact !== 'nein' && !has(a.adverse_impact_note)) m.push(`${label}: Folgebewertung`);
        if (!has(a.evidence_text)) m.push(`${label}: Umsetzungsnachweis`);
      }
    }
    checks.push({ no: 10, complete: m.length === 0, missing: m, skipped: noCapa });
  }
  // 11
  {
    const m: string[] = [];
    if (capa.fsca_affected === null || capa.fsca_affected === undefined) m.push('Sind ausgelieferte Produkte betroffen?');
    if (capa.fsca_affected === true) {
      const f = capa.fsca || {};
      if (!has(f.measure)) m.push('FSCA-Maßnahme');
      if (!has(f.responsible)) m.push('FSCA-Verantwortlicher');
      if (!has(capa.fsca_released_by)) m.push('FSCA-Freigabe (QMB)');
    }
    checks.push({ no: 11, complete: m.length === 0, missing: m });
  }
  // 12
  {
    const m: string[] = [];
    if (!noCapa) {
      if (!has(capa.eff_criterion)) m.push('Wirksamkeitskriterium');
      if (!has(capa.eff_method)) m.push('Messmethode');
      if (!has(capa.eff_result)) m.push('Ergebnis der Wirksamkeitsprüfung');
      if (capa.eff_result === 'noch_nicht_bewertbar') m.push('Wirksamkeit noch nicht bewertbar');
      if (capa.eff_result === 'nicht_wirksam') m.push('Nicht wirksam – Folgeanalyse erforderlich');
    }
    checks.push({ no: 12, complete: m.length === 0, missing: m, skipped: noCapa });
  }

  return checks;
}

export function progressPct(checks: StepCheck[]) {
  const relevant = checks.filter(c => !c.skipped);
  if (!relevant.length) return 0;
  return Math.round((relevant.filter(c => c.complete).length / relevant.length) * 100);
}

export function firstOpenStep(checks: StepCheck[]) {
  const open = checks.find(c => !c.skipped && !c.complete);
  return open?.no ?? 12;
}

export function closureBlockers(capa: CapaAny, checks: StepCheck[]): string[] {
  const b: string[] = [];
  for (const c of checks) {
    if (!c.skipped && !c.complete) b.push(`Schritt ${c.no}: ${CAPA_STEPS[c.no - 1].title}`);
  }
  if (!has(capa.closure_summary)) b.push('Abschlussbewertung fehlt');
  if (capa.eff_result === 'nicht_wirksam') b.push('Wirksamkeitsprüfung: NICHT WIRKSAM – CAPA darf nicht geschlossen werden');
  return b;
}

export function trafficLight(capa: CapaAny): 'gruen' | 'gelb' | 'rot' {
  if (capa.status === 'geschlossen') return 'gruen';
  const dates = [capa.due_date, capa.vigilance_deadline_date].filter(Boolean).map((d: string) => new Date(d).getTime());
  if (!dates.length) return 'gruen';
  const soonest = Math.min(...dates);
  const days = (soonest - Date.now()) / 86400000;
  if (days < 0) return 'rot';
  if (days <= 7) return 'gelb';
  if (capa.risk_level === 'kritisch' || capa.risk_level === 'hoch') return 'gelb';
  return 'gruen';
}

export function labelize(s?: string | null) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
