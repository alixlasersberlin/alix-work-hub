import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CAPA_STEPS, INVESTIGATION_ITEMS, VIGILANCE_QUESTIONS, SCOPE_QUESTIONS, RISK_QUESTIONS, labelize, CapaAny,
} from './steps';

function kv(pairs: [string, any][]) {
  return pairs.map(([k, v]) => [k, v === null || v === undefined || v === '' ? '—' : String(v)]);
}

export function buildCapaReport(capa: CapaAny, actions: CapaAny[], timeline: CapaAny[], attachments: CapaAny[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = `CAPA-Bericht ${capa.capa_number ?? ''}`;
  let y = 48;

  doc.setFontSize(16); doc.text(title, 40, y); y += 18;
  doc.setFontSize(9);
  doc.text(`${capa.title ?? ''} · Erstellt ${new Date().toLocaleString('de-DE')}`, 40, y); y += 12;

  const section = (heading: string, body: string[][]) => {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 16 : y,
      head: [[heading, '']],
      body: body.length ? body : [['—', '']],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] },
      columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
      margin: { left: 40, right: 40 },
    });
  };

  section('1. Stammdaten / Reklamation', kv([
    ['CAPA-Nummer', capa.capa_number], ['Status', labelize(capa.status)], ['Priorität', labelize(capa.priority)],
    ['Risikostufe', labelize(capa.risk_level)], ['Reklamationsnummer', capa.complaint_number], ['Eingangsdatum', capa.received_date],
    ['Kunde / Melder', capa.customer_name], ['Produkt', capa.product_name], ['REF', capa.product_ref], ['UDI', capa.udi],
    ['Seriennummer', capa.serial_number], ['Charge', capa.batch_number], ['Patient / Anwender', capa.patient_affected],
    ['Land', capa.country], ['Markt', capa.market], ['Standort', capa.site], ['Beschreibung', capa.description],
    ['Gesundheitliche Folgen', capa.health_consequences], ['Produkt gesichert', labelize(capa.product_secured)],
    ['Begründung', capa.product_secured_reason],
  ]));

  section('2. Sofortmaßnahmen / Containment', kv([
    ['Unmittelbare Gefährdung', labelize(capa.immediate_danger)],
    ['Sofortmaßnahmen', (capa.containment_actions ?? []).join(', ')],
    ['Correction', capa.correction_text ?? capa.immediate_action],
    ['Corrective Action', capa.corrective_action],
  ]));

  section('3. MDR-Vigilanzbewertung', kv([
    ...VIGILANCE_QUESTIONS.map(q => [q.label, labelize((capa.vigilance_answers ?? {})[q.key])] as [string, any]),
    ['Ergebnis', labelize(capa.vigilance_result)], ['Fristenkategorie', capa.vigilance_rule_code],
    ['Meldefrist', capa.vigilance_deadline_date], ['Vorläufig', capa.vigilance_preliminary ? 'ja' : 'nein'],
    ['QMB-Freigabe', capa.vigilance_approved_at],
  ]));

  section('4. Untersuchung', INVESTIGATION_ITEMS.map(it => {
    const r = (capa.investigation ?? {})[it.key] ?? {};
    return [it.label, `${labelize(r.status)}${r.note ? ` – ${r.note}` : ''}`];
  }));

  section('5. Nichtkonformität und Umfang', kv([
    ...SCOPE_QUESTIONS.map(q => [q.label, labelize((capa.scope_answers ?? {})[q.key])] as [string, any]),
    ['Ergebnis', labelize(capa.scope_result)],
  ]));

  section('6. PMS- und Trendabgleich', kv([
    ['Bewertung', labelize(capa.pms_assessment)],
    ['Kennzahlen', JSON.stringify(capa.pms_stats ?? {})],
  ]));

  section('7. CAPA-Entscheidung', kv([
    ['Ergebnis', capa.capa_required === false ? 'NO-CAPA-DECISION' : capa.capa_required ? 'CAPA eröffnet' : '—'],
    ['Begründung (No-CAPA)', capa.no_capa_reason], ['Risikobewertung (No-CAPA)', capa.no_capa_risk],
    ['Entscheidung am', capa.decision_at], ['QMB-Freigabe', capa.decision_approved_at],
  ]));

  section('8. Root Cause Analysis', kv([
    ['Methode', labelize(capa.rca_method)], ['Fehlerbild', capa.failure_mode], ['Direkte Ursache', capa.direct_cause],
    ['Root Cause', capa.root_cause], ['Ursachenart', labelize(capa.root_cause_kind)],
    ['Status', labelize(capa.root_cause_status)], ['Begründung', capa.root_cause_note],
    ['Analyse', JSON.stringify(capa.rca_data ?? {})],
  ]));

  section('9. Risikomanagement', kv([
    ...RISK_QUESTIONS.map(q => [q.label, labelize((capa.risk_answers ?? {})[q.key])] as [string, any]),
    ['Vorher', JSON.stringify(capa.risk_before ?? {})], ['Nachher', JSON.stringify(capa.risk_after ?? {})],
    ['Entscheidung', labelize(capa.risk_decision)], ['Nachweis', capa.risk_evidence],
  ]));

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [['10. Maßnahmen', 'Kategorie', 'Frist', 'Status', 'Nachweis', 'Nachteilige Auswirkung']],
    body: actions.length ? actions.map(a => [
      a.action_text, a.category ?? '—', a.due_date ?? '—', labelize(a.status), a.evidence_text ?? '—',
      `${labelize(a.adverse_impact)}${a.adverse_impact_note ? ` – ${a.adverse_impact_note}` : ''}`,
    ]) : [['—', '', '', '', '', '']],
    styles: { fontSize: 7, cellPadding: 3 }, headStyles: { fillColor: [30, 30, 30] }, margin: { left: 40, right: 40 },
  });

  section('11. Feldmaßnahmen / FSCA', kv([
    ['Ausgelieferte Produkte betroffen', capa.fsca_affected === true ? 'ja' : capa.fsca_affected === false ? 'nein' : '—'],
    ...Object.entries(capa.fsca ?? {}).map(([k, v]) => [labelize(k), String(v)] as [string, any]),
    ['FSCA-Freigabe', capa.fsca_released_at],
  ]));

  section('12. Wirksamkeitsprüfung', kv([
    ['Kriterium', capa.eff_criterion], ['Messmethode', capa.eff_method], ['Zeitraum', capa.eff_period],
    ['Start', capa.eff_start], ['Prüfdatum', capa.eff_check_date], ['Sollwert', capa.eff_target],
    ['Istwert', capa.eff_actual], ['Ergebnis', labelize(capa.eff_result)], ['Nachweis', capa.eff_evidence],
  ]));

  section('Abschluss und Freigaben', kv([
    ['Abschlussbewertung', capa.closure_summary], ['Abgeschlossen am', capa.closed_at],
    ['Freigabe am', capa.closure_approved_at],
  ]));

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [['Anhänge / Nachweise', 'Schritt', 'Datum']],
    body: attachments.length ? attachments.map(a => [a.file_name, String(a.step_no ?? '—'), new Date(a.created_at).toLocaleString('de-DE')]) : [['—', '', '']],
    styles: { fontSize: 7 }, headStyles: { fillColor: [30, 30, 30] }, margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [['Audit-Trail', 'Wer', 'Wann', 'Alt', 'Neu']],
    body: timeline.length ? timeline.slice(0, 200).map(t => [
      `${labelize(t.event_type)}${t.field_name ? `: ${t.field_name}` : ''}${t.note ? ` – ${t.note}` : ''}`,
      t.actor_name ?? '—', new Date(t.created_at).toLocaleString('de-DE'),
      (t.old_value ?? '—').slice(0, 60), (t.new_value ?? '—').slice(0, 60),
    ]) : [['—', '', '', '', '']],
    styles: { fontSize: 6.5 }, headStyles: { fillColor: [30, 30, 30] }, margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7);
    doc.text(`${title} · Seite ${i}/${pages} · ${CAPA_STEPS.length}-Schritte-Prozess ISO 13485 / MDR`, 40, 820);
  }
  doc.save(`${capa.capa_number ?? 'CAPA'}-Bericht.pdf`);
}
