import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;

export type ParsedQuestion = {
  label: string;
  qtype: string;
  required: boolean;
  options: string[];
  help_text?: string | null;
};

/** Volltext aus einer PDF-Datei extrahieren (zeilenweise). */
export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let current = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform?.[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(current.trim());
        current = '';
      }
      current += item.str;
      lastY = y;
    }
    if (current.trim()) lines.push(current.trim());
  }
  try { doc.destroy(); } catch { /* noop */ }
  return lines.join('\n');
}

/** Volltext aus einer Word-Datei (.docx) extrahieren. */
export async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth/mammoth.browser');
  const buf = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (mammoth as any).extractRawText({ arrayBuffer: buf });
  return String(res?.value ?? '');
}

const TYPE_HINTS: Record<string, string> = {
  sterne: 'stars', stars: 'stars', bewertung: 'stars',
  freitext: 'textarea', textarea: 'textarea', text: 'text',
  janein: 'yesno', yesno: 'yesno', 'ja/nein': 'yesno',
  einfachauswahl: 'single', single: 'single', auswahl: 'single',
  mehrfachauswahl: 'multi', multi: 'multi',
  dropdown: 'dropdown', nps: 'nps', skala: 'scale10', scale10: 'scale10',
  slider: 'slider', datum: 'date', date: 'date', zahl: 'number', number: 'number',
  upload: 'upload', consent: 'consent', signature: 'signature', unterschrift: 'signature',
};

const clean = (s: string) =>
  s.replace(/\u00a0/g, ' ').replace(/^\s*(?:\d+[.)]|[-•*–])\s*/, '').trim();

/**
 * Heuristischer Parser: erkennt Fragen aus PDF-/Word-Fließtext.
 * - Fragezeilen: enden auf "?" oder beginnen mit Nummerierung ("1." / "1)")
 * - Antwortoptionen: Folgezeilen mit "-", "•", "*", "o " oder "[ ]"
 * - Typ:  "(Sterne)", "[stars]" oder "Typ: stars" in der Fragezeile
 * - Pflicht: "*" am Zeilenende oder "(Pflicht)"
 */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const rawLines = text.split(/\r?\n/).map(l => l.replace(/\u00a0/g, ' ').trimEnd()).filter(l => l.trim());
  const out: ParsedQuestion[] = [];

  const isOption = (l: string) => /^\s*(?:[-•*–o]\s+|\[\s*\]|\(\s*\)|[a-hA-H][.)]\s+)/.test(l);
  const isQuestion = (l: string) => /\?\s*$/.test(l) || /^\s*\d+\s*[.)]\s+\S/.test(l);

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (isOption(line)) continue;
    if (!isQuestion(line)) continue;

    let label = clean(line);
    let qtype = '';
    let required = false;

    const typeMatch = label.match(/[([]\s*(?:typ\s*[:=]\s*)?([A-Za-zÄÖÜäöüß/ ]{3,20})\s*[)\]]\s*$/);
    if (typeMatch) {
      const key = typeMatch[1].toLowerCase().replace(/\s/g, '');
      if (key === 'pflicht' || key === 'required') {
        required = true;
        label = label.slice(0, typeMatch.index).trim();
      } else if (TYPE_HINTS[key]) {
        qtype = TYPE_HINTS[key];
        label = label.slice(0, typeMatch.index).trim();
      }
    }
    const inlineType = label.match(/\btyp\s*[:=]\s*([a-zA-Z0-9]+)\b/i);
    if (inlineType) {
      const k = inlineType[1].toLowerCase();
      qtype = TYPE_HINTS[k] ?? k;
      label = label.replace(inlineType[0], '').trim();
    }
    if (/\*\s*$/.test(label)) { required = true; label = label.replace(/\*\s*$/, '').trim(); }
    if (/\(pflicht\)/i.test(label)) { required = true; label = label.replace(/\(pflicht\)/i, '').trim(); }

    // Optionen einsammeln
    const options: string[] = [];
    let j = i + 1;
    while (j < rawLines.length && isOption(rawLines[j])) {
      const opt = clean(rawLines[j].replace(/^\s*(?:\[\s*\]|\(\s*\))\s*/, '').replace(/^[a-hA-H][.)]\s+/, ''));
      if (opt) options.push(opt);
      j++;
    }
    i = j - 1;

    if (!label) continue;
    if (!qtype) {
      if (options.length >= 2) qtype = 'single';
      else if (/zufrieden|bewert|sterne/i.test(label)) qtype = 'stars';
      else if (/weiterempfehl|nps/i.test(label)) qtype = 'nps';
      else if (/warum|beschreib|verbesser|anmerk|kommentar/i.test(label)) qtype = 'textarea';
      else qtype = 'text';
    }
    out.push({ label, qtype, required, options });
  }

  return out;
}

export async function parseQuestionsFromFile(file: File): Promise<ParsedQuestion[]> {
  const name = file.name.toLowerCase();
  let text = '';
  if (name.endsWith('.pdf')) text = await extractPdfText(file);
  else if (name.endsWith('.docx')) text = await extractDocxText(file);
  else if (name.endsWith('.doc')) throw new Error('Altes .doc-Format wird nicht unterstützt — bitte als .docx speichern.');
  else if (name.endsWith('.txt')) text = await file.text();
  else throw new Error('Nicht unterstütztes Format');
  return parseQuestionsFromText(text);
}
