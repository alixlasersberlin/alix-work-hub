import { supabase } from '@/integrations/supabase/client';
import { createPDF } from '@/lib/pdf-utils';

type Opt = { label: string | null };

const GOLD: [number, number, number] = [198, 161, 91];
const DARK: [number, number, number] = [17, 17, 17];
const GREY: [number, number, number] = [110, 110, 110];

function answerHint(qtype: string | null, opts: Opt[]): string[] {
  if (opts.length) return opts.map((o) => `[  ]  ${o.label ?? ''}`);
  switch (qtype) {
    case 'yesno':
      return ['[  ] Nein     [  ] Ja'];
    case 'date':
      return ['Datum: __ __ / __ __ / __ __ __ __'];
    case 'number':
      return ['____________'];
    case 'textarea':
      return ['______________________________', '______________________________', '______________________________'];
    case 'rating':
    case 'nps':
      return ['0  1  2  3  4  5  6  7  8  9  10'];
    default:
      return ['______________________________'];
  }
}

/**
 * Lädt eine Umfrage inkl. Abschnitte, Fragen und Optionen und erzeugt daraus
 * ein druckfertiges PDF (Fragebogen zum Ausfüllen).
 */
export async function downloadSurveyPdf(surveyId: string) {
  const sb = supabase as any;

  const [{ data: survey }, { data: sections }, { data: questions }] = await Promise.all([
    sb.from('surveys').select('*').eq('id', surveyId).single(),
    sb.from('survey_sections').select('*').eq('survey_id', surveyId).order('position'),
    sb.from('survey_questions').select('*').eq('survey_id', surveyId).order('position'),
  ]);
  if (!survey) throw new Error('Umfrage nicht gefunden');

  const qIds = (questions ?? []).map((q: any) => q.id);
  let optsByQ: Record<string, Opt[]> = {};
  if (qIds.length) {
    const { data: opts } = await sb
      .from('survey_question_options')
      .select('question_id,label,position')
      .in('question_id', qIds)
      .order('position');
    for (const o of opts ?? []) {
      (optsByQ[o.question_id] ||= []).push({ label: o.label });
    }
  }

  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const PW = 210;
  const M = 20;
  const CW = PW - M * 2;
  let y = 0;
  let page = 1;

  const header = () => {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, PW, 10, 'F');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('ALIX LASERS', M, 6.5);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(survey.public_title || survey.name || 'Umfrage'), PW - M, 6.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y = 22;
  };
  const footer = () => {
    doc.setDrawColor(220);
    doc.line(M, 281, PW - M, 281);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text('Alix Lasers – Vertraulich', M, 286);
    doc.text(`Seite ${page}`, PW - M, 286, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };
  const ensure = (h: number) => {
    if (y + h > 274) {
      footer();
      doc.addPage();
      page++;
      header();
    }
  };

  header();

  // Titel
  doc.setFont('Inter', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...DARK);
  const titleLines = doc.splitTextToSize(String(survey.public_title || survey.name), CW);
  doc.text(titleLines, M, y);
  y += titleLines.length * 7 + 1;
  doc.setFillColor(...GOLD);
  doc.rect(M, y, 40, 0.8, 'F');
  y += 7;

  if (survey.intro_text) {
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...GREY);
    for (const para of String(survey.intro_text).split(/\n{1,}/)) {
      if (!para.trim()) { y += 2; continue; }
      const lines = doc.splitTextToSize(para.trim(), CW);
      ensure(lines.length * 4.6 + 2);
      doc.text(lines, M, y);
      y += lines.length * 4.6 + 2;
    }
    y += 3;
  }

  // Kopf-Felder
  doc.setTextColor(...DARK);
  doc.setFontSize(9.5);
  const metaRows: [string, string][] = [
    ['Institut / Praxis:', 'Datum:'],
    ['Ansprechpartner:', 'Gerät / SN:'],
  ];
  for (const [l, r] of metaRows) {
    ensure(9);
    doc.text(l, M, y);
    doc.setDrawColor(180);
    doc.line(M + 33, y + 1, M + 90, y + 1);
    doc.text(r, M + 96, y);
    doc.line(M + 125, y + 1, PW - M, y + 1);
    y += 8;
  }
  y += 2;

  const renderQuestion = (q: any) => {
    const opts = optsByQ[q.id] ?? [];
    const labelLines: string[] = doc.splitTextToSize(
      `${q.label ?? ''}${q.required ? ' *' : ''}`,
      CW - 18 - 62,
    );
    const helpLines: string[] = q.help_text ? doc.splitTextToSize(String(q.help_text), CW - 18 - 62) : [];
    const ansLines = answerHint(q.qtype, opts).flatMap((l: string) => doc.splitTextToSize(l, 60));
    const h = Math.max(labelLines.length * 4.4 + helpLines.length * 3.6, ansLines.length * 4.4) + 5;
    ensure(h + 2);

    const top = y;
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(String(q.internal_number ?? ''), M, top + 3.4);

    doc.setFont('Inter', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(labelLines, M + 18, top + 3.4);
    let inner = top + 3.4 + labelLines.length * 4.4;
    if (helpLines.length) {
      doc.setFontSize(7.6);
      doc.setTextColor(...GREY);
      doc.text(helpLines, M + 18, inner);
      inner += helpLines.length * 3.6;
    }

    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(ansLines, M + CW - 62, top + 3.4);

    y = top + h;
    doc.setDrawColor(225);
    doc.line(M, y - 1.5, PW - M, y - 1.5);
  };

  const renderSection = (title: string, description?: string | null, list: any[] = []) => {
    if (!list.length) return;
    ensure(20);
    y += 3;
    doc.setFillColor(...DARK);
    doc.rect(M, y, CW, 9, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(M, y, 1.5, 9, 'F');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, M + 5, y + 6);
    y += 12;
    doc.setTextColor(...GREY);
    doc.setFont('Inter', 'normal');
    if (description) {
      doc.setFontSize(8.2);
      const lines = doc.splitTextToSize(String(description), CW);
      ensure(lines.length * 3.9 + 3);
      doc.text(lines, M, y);
      y += lines.length * 3.9 + 3;
    }
    doc.setTextColor(...DARK);
    for (const q of list) renderQuestion(q);
  };

  const visible = (questions ?? []).filter((q: any) => q.visible !== false);
  const noSection = visible.filter((q: any) => !q.section_id);
  if (noSection.length && !(sections ?? []).length) {
    renderSection('Fragen', null, noSection);
  } else {
    if (noSection.length) renderSection('Allgemein', null, noSection);
    for (const s of sections ?? []) {
      renderSection(s.title, s.description, visible.filter((q: any) => q.section_id === s.id));
    }
  }

  if (survey.outro_text) {
    ensure(20);
    y += 5;
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...GREY);
    const lines = doc.splitTextToSize(String(survey.outro_text), CW);
    doc.text(lines, M, y);
    y += lines.length * 4.6 + 6;
  }

  ensure(20);
  y += 6;
  doc.setTextColor(...DARK);
  doc.setFontSize(9.5);
  doc.text('Ort, Datum:', M, y);
  doc.setDrawColor(180);
  doc.line(M, y + 6, M + 75, y + 6);
  doc.text('Unterschrift:', M + 95, y);
  doc.line(M + 95, y + 6, PW - M, y + 6);

  footer();

  const safe = String(survey.name || 'Umfrage').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '-');
  doc.save(`${safe || 'Umfrage'}.pdf`);
}
