// ALIX PRODUCT HUB – automatischer Qualitätscheck für Übersetzungen
// Deterministisch, ohne KI: vergleicht Zielsprache gegen deutschen Master.

export type QaIssue = { code: string; level: "warning" | "blocked"; field?: string; message: string };
export type QaResult = { status: "pass" | "warning" | "blocked"; score: number; issues: QaIssue[] };

const GERMAN_WORDS = [
  "und", "oder", "nicht", "mit", "für", "die", "der", "das", "eine", "einen", "wird", "werden",
  "sowie", "durch", "kann", "sind", "bei", "auf", "von", "zum", "zur", "sich", "ihre", "unsere",
];

const CLAIM_PATTERNS = [
  /\bheil(t|ung|en)\b/i, /\bcures?\b/i, /\bheals?\b/i, /\bguarantee(d|s)?\b/i,
  /\bpain[- ]free guarantee\b/i, /\b100\s?% (safe|effective|success)\b/i, /\bmedically proven\b/i,
];
const APPROVAL_PATTERNS = [/\bFDA\b/i, /\bCE[- ]?(mark|certified|zertifiziert)\b/i, /\bMDR\b/i, /\bISO\s?13485\b/i];

const NUM_RE = /\d+(?:[.,]\d+)?/g;

const txt = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.filter(x => typeof x === "string").join(" ") : "");

function joinAll(o: Record<string, unknown>, fields: string[]) {
  return fields.map(f => txt(o[f])).join("\n");
}

function numbers(s: string): string[] {
  return (s.match(NUM_RE) ?? []).map(n => n.replace(",", "."));
}

export function qaCheck(opts: {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  locale: string;
  model?: string | null;
  brands?: string[];
  /** Technische Kontextwerte (Wellenlängen, Leistung …) – dort vorkommende Zahlen sind zulässig. */
  context?: string;
}): QaResult {
  const { source, target, locale } = opts;
  const issues: QaIssue[] = [];
  const fields = [
    "name", "short_description", "long_description", "marketing_text", "notices",
    "seo_title", "seo_description", "intended_use",
    "highlights", "benefits", "applications", "treatments", "features",
  ];
  // SEO-Texte werden bewusst eigenständig getextet und daher nicht auf Zahlengleichheit geprüft.
  const contentFields = fields.filter(f => !f.startsWith("seo_"));
  const srcAll = joinAll(source, fields);
  const tgtAll = joinAll(target, fields);
  const srcContent = joinAll(source, contentFields);
  const tgtContent = joinAll(target, contentFields);

  // 1. Pflichtfelder
  for (const f of ["name", "short_description", "long_description", "seo_title", "seo_description"]) {
    if (!txt(target[f]).trim()) {
      issues.push({ code: "missing_field", level: f === "name" ? "blocked" : "warning", field: f, message: `Feld fehlt: ${f}` });
    }
  }

  // 2. Deutsche Textreste (nur für nicht-deutsche Zielsprachen mit lateinischer Schrift relevant)
  if (locale !== "de") {
    const low = ` ${tgtAll.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
    const hits = GERMAN_WORDS.filter(w => low.includes(` ${w} `));
    if (locale === "en" && hits.length >= 2) {
      issues.push({ code: "german_leftover", level: "blocked", message: `Deutsche Textreste erkannt: ${hits.slice(0, 6).join(", ")}` });
    } else if (hits.length >= 3) {
      issues.push({ code: "german_leftover", level: "warning", message: `Mögliche deutsche Textreste: ${hits.slice(0, 6).join(", ")}` });
    }

    // 2b. Zielschrift vorhanden? (Russisch = Kyrillisch, Arabisch = arabische Schrift)
    const body = joinAll(target, ["short_description", "long_description", "marketing_text"]);
    if (locale === "ru" && body.trim() && !/\p{Script=Cyrillic}/u.test(body)) {
      issues.push({ code: "wrong_script", level: "blocked", message: "Russische Übersetzung enthält keine kyrillische Schrift." });
    }
    if (locale === "ar" && body.trim() && !/\p{Script=Arabic}/u.test(body)) {
      issues.push({ code: "wrong_script", level: "blocked", message: "Arabische Übersetzung enthält keine arabische Schrift." });
    }
    // 2c. Arabische Ziffern statt westlicher Ziffern bei technischen Werten
    if (locale === "ar" && /[\u0660-\u0669\u06F0-\u06F9]/.test(tgtAll)) {
      issues.push({ code: "arabic_digits", level: "blocked", message: "Technische Werte wurden in arabisch-indische Ziffern umgeschrieben." });
    }
    // 2d. Englische Textreste in ES/RU/AR
    if (["es", "ru", "ar"].includes(locale)) {
      const en = ["the", "and", "with", "for", "this", "that", "your", "from", "these", "which"];
      const hitsEn = en.filter(w => low.includes(` ${w} `));
      if (hitsEn.length >= 3) {
        issues.push({ code: "english_leftover", level: "warning", message: `Mögliche englische Textreste: ${hitsEn.slice(0, 6).join(", ")}` });
      }
    }
  }

  // 3. Zahlen / Messwerte unverändert
  const srcNums = new Set([...numbers(srcContent), ...numbers(opts.context ?? "")]);
  const tgtNums = new Set(numbers(tgtContent));
  const lost = [...numbers(srcContent)].filter(n => !tgtNums.has(n));
  const added = [...tgtNums].filter(n => !srcNums.has(n));
  if (lost.length) {
    issues.push({ code: "numbers_lost", level: lost.length > 2 ? "blocked" : "warning", message: `Zahlenwerte fehlen in der Übersetzung: ${lost.slice(0, 8).join(", ")}` });
  }
  if (added.length) {
    issues.push({ code: "numbers_added", level: "blocked", message: `Zusätzliche/veränderte Zahlenwerte: ${added.slice(0, 8).join(", ")}` });
  }

  // 4. Einheiten
  // Nur Einheiten zählen, die zu einer Zahl gehören – sonst werden Wörter wie „Wärme" fälschlich als Watt gewertet.
  const unitRe = /\d\s?(nm|kW|W|Hz|ms|ns|J\/cm²|°C|bar|kg|mm|cm|dB|DB)(?![A-Za-zÄÖÜäöüß])/g;
  const cnt = (s: string) => (s.match(unitRe) ?? []).length;
  if (cnt(srcContent) > cnt(tgtContent)) {
    issues.push({ code: "units_lost", level: "warning", message: "Maßeinheiten sind in der Übersetzung seltener als im deutschen Master." });
  }

  // 5. Modell / Marken müssen erhalten bleiben
  const keep = [opts.model, ...(opts.brands ?? [])].filter(Boolean) as string[];
  for (const k of keep) {
    if (k.length < 3) continue;
    if (srcAll.includes(k) && !tgtAll.includes(k)) {
      issues.push({ code: "brand_changed", level: "blocked", message: `Marke/Modell wurde verändert oder entfernt: ${k}` });
    }
  }

  // 6. Doppelte / unveränderte Texte
  if (locale !== "de") {
    for (const f of ["short_description", "long_description"]) {
      const s = txt(source[f]).trim(), t = txt(target[f]).trim();
      if (s && t && s === t) issues.push({ code: "untranslated", level: "blocked", field: f, message: `Text wurde nicht übersetzt: ${f}` });
    }
  }
  if (txt(target.short_description).trim() && txt(target.short_description).trim() === txt(target.long_description).trim()) {
    issues.push({ code: "duplicate_text", level: "warning", message: "Kurz- und Langbeschreibung sind identisch." });
  }

  // 7. Heilversprechen
  for (const re of CLAIM_PATTERNS) {
    if (re.test(tgtAll) && !re.test(srcAll)) {
      issues.push({ code: "medical_claim", level: "blocked", message: `Unzulässige Wirkungsaussage in der Übersetzung: ${re.source}` });
      break;
    }
  }
  // 8. Erfundene Zulassungen
  for (const re of APPROVAL_PATTERNS) {
    if (re.test(tgtAll) && !re.test(srcAll)) {
      issues.push({ code: "invented_approval", level: "blocked", message: `Zulassungsaussage ohne Grundlage im Master: ${re.source}` });
      break;
    }
  }

  // 9. SEO
  const st = txt(target.seo_title).trim();
  if (st && (st.length < 25 || st.length > 70)) {
    issues.push({ code: "seo_title_length", level: "warning", message: `SEO Title ist ${st.length} Zeichen (empfohlen 25–70).` });
  }
  const sd = txt(target.seo_description).trim();
  if (sd && (sd.length < 70 || sd.length > 175)) {
    issues.push({ code: "seo_desc_length", level: "warning", message: `Meta Description ist ${sd.length} Zeichen (empfohlen 70–175).` });
  }

  // 10. Technische Textwerte (sprachabhängig)
  if (txt(source.intended_use).trim() && !txt(target.intended_use).trim()) {
    issues.push({ code: "technical_label_missing", level: "warning", field: "intended_use", message: "Zweckbestimmung wurde nicht übersetzt." });
  }
  // Fehlt bereits der deutsche Master, ist das kein Übersetzungsfehler.
  if (!txt(source.intended_use).trim()) {
    issues.push({ code: "source_master_missing", level: "info", field: "intended_use", message: "SOURCE MASTER MISSING – Zweckbestimmung ist bereits im deutschen Master leer." });
  }
  if (!txt(source.product_group_label).trim() && !txt(target.product_group_label).trim()) {
    issues.push({ code: "source_master_missing", level: "info", field: "product_group_label", message: "SOURCE MASTER MISSING – Kategoriebezeichnung ist bereits im deutschen Master leer." });
  }

  // 11. Listenlängen
  for (const f of ["highlights", "benefits", "applications", "treatments", "features"]) {
    const s = Array.isArray(source[f]) ? (source[f] as unknown[]).length : 0;
    const t = Array.isArray(target[f]) ? (target[f] as unknown[]).length : 0;
    if (s && t !== s) issues.push({ code: "list_length", level: "warning", field: f, message: `Listenlänge weicht ab (${f}: DE ${s} / Ziel ${t}).` });
  }

  const blocked = issues.some(i => i.level === "blocked");
  const score = Math.max(0, 100 - issues.reduce((n, i) => n + (i.level === "blocked" ? 30 : 8), 0));
  return { status: blocked ? "blocked" : issues.length ? "warning" : "pass", score, issues };
}
