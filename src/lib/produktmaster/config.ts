// ALIX PRODUCT MASTER – zentrale Konfiguration (additiv auf dem bestehenden Product Hub)

export const PM_STATUS: { code: string; label: string }[] = [
  { code: 'draft', label: 'Entwurf' },
  { code: 'review', label: 'In Prüfung' },
  { code: 'approved', label: 'Freigegeben' },
  { code: 'published', label: 'Aktiv / Veröffentlicht' },
  { code: 'locked', label: 'Gesperrt' },
  { code: 'phaseout', label: 'Auslaufartikel' },
  { code: 'archived', label: 'Archiviert' },
];

export const pmStatusLabel = (c?: string | null) =>
  PM_STATUS.find(s => s.code === c)?.label || c || '—';

export const PM_CATEGORIES = [
  'Diodenlaser', 'Alexandritlaser', 'Nd:YAG Laser', 'Tattoo Laser', 'IPL / SHR', 'HIFU', 'RF',
  'Bodyforming', 'Skin-System', 'Diagnosesystem', 'Zubehör', 'Ersatzteil', 'Verbrauchsmaterial',
] as const;

export const PM_APPLICATIONS = [
  'Haarentfernung', 'Tattooentfernung', 'Pigmentbehandlung', 'Hautverjüngung', 'Akne',
  'Gefäßbehandlung', 'Carbon Peeling', 'Hautstraffung', 'Bodyforming', 'Muskelaufbau',
  'Gesichtsbehandlung', 'Körperbehandlung',
] as const;

export const PM_SEGMENTS = ['Beauty', 'Medical', 'Commercial'] as const;

export const PM_ATTR_TYPES = [
  { code: 'text', label: 'Text' },
  { code: 'number', label: 'Zahl' },
  { code: 'select', label: 'Auswahl' },
  { code: 'multiselect', label: 'Mehrfachauswahl' },
  { code: 'boolean', label: 'Ja / Nein' },
] as const;

export const PM_ATTR_GROUPS = [
  'Lasertechnik', 'Gerät', 'Software & KI', 'Anschluss', 'Stromversorgung', 'Abmessungen', 'Umgebung', 'Sonstiges',
] as const;

export const PM_COMPLIANCE_STATUS: { code: string; label: string; tone: string }[] = [
  { code: 'not_checked', label: 'Nicht geprüft', tone: 'bg-muted text-muted-foreground' },
  { code: 'in_review', label: 'In Prüfung', tone: 'bg-amber-500/15 text-amber-600' },
  { code: 'approved', label: 'Freigegeben', tone: 'bg-emerald-500/15 text-emerald-600' },
  { code: 'rejected', label: 'Abgelehnt', tone: 'bg-destructive/15 text-destructive' },
  { code: 'recheck_required', label: 'Erneute Prüfung erforderlich', tone: 'bg-destructive/15 text-destructive' },
];

export const pmComplianceLabel = (c?: string | null) =>
  PM_COMPLIANCE_STATUS.find(s => s.code === c)?.label || 'Nicht geprüft';
export const pmComplianceTone = (c?: string | null) =>
  PM_COMPLIANCE_STATUS.find(s => s.code === c)?.tone || 'bg-muted text-muted-foreground';

export const PM_WORKFLOW_STEPS = [
  { code: 'technical', label: 'Technische Prüfung' },
  { code: 'compliance', label: 'Compliance Prüfung' },
  { code: 'marketing', label: 'Marketing Prüfung' },
] as const;

export const PM_UNITS = ['Stk', 'Set', 'Paar', 'm', 'Liter', 'Paket'] as const;

export const PM_LANDINGPAGES = [
  'Diodenlaser', 'Haarentfernung', 'Alexandritlaser', 'Tattooentfernung', 'Pigmentbehandlung',
  'Skin', 'Body', 'HIFU', 'Regional Berlin', 'Regional München', 'Regional Wien',
] as const;

export interface PmBundle {
  product: any;
  prices?: any;
  compliance?: any;
  marketing?: any;
  seo?: any;
  mediaCount?: number;
  docCount?: number;
  attrCount?: number;
}

export interface PmScoreSection { key: string; label: string; score: number; missing: string[] }

/** Datenqualität je Bereich + Gesamtscore */
export function pmQuality(b: PmBundle): { total: number; sections: PmScoreSection[] } {
  const p = b.product || {};
  const sec = (key: string, label: string, checks: [string, any][]): PmScoreSection => {
    const missing = checks.filter(([, v]) =>
      v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || v === false,
    ).map(([l]) => l);
    const score = checks.length ? Math.round(((checks.length - missing.length) / checks.length) * 100) : 100;
    return { key, label, score, missing };
  };

  const sections: PmScoreSection[] = [
    sec('master', 'Stammdaten', [
      ['Artikelnummer / SKU', p.sku], ['Produktname', p.name], ['Modell', p.model],
      ['Kategorie', p.categories], ['Marke', p.brand], ['Hersteller', p.manufacturer],
    ]),
    sec('tech', 'Technik', [
      ['Wellenlängen', p.wavelengths], ['Leistung', p.power], ['Kühlung', p.cooling],
      ['Laserklasse', p.laser_class], ['Technische Attribute', (b.attrCount || 0) > 0 ? 'x' : ''],
    ]),
    sec('sales', 'Verkauf', [
      ['Verkaufspreis', b.prices?.sale_price_net], ['UVP', b.prices?.rrp_net],
      ['Lieferzeit', b.prices?.delivery_time], ['Garantie', b.prices?.warranty],
    ]),
    sec('media', 'Medien', [
      ['Hauptbild', p.hero_image_url], ['Galeriebilder', (b.mediaCount || 0) > 0 ? 'x' : ''],
    ]),
    sec('docs', 'Dokumente', [['Dokumente hinterlegt', (b.docCount || 0) > 0 ? 'x' : '']]),
    sec('compliance', 'Compliance', [
      ['Compliance freigegeben', b.compliance?.approval_status === 'approved'],
      ['Zweckbestimmung', p.intended_use], ['Konformitätserklärung', b.compliance?.doc_declaration],
    ]),
    sec('seo', 'SEO', [
      ['SEO Titel', b.seo?.seo_title || p.seo_title], ['Meta Description', b.seo?.meta_description || p.seo_description],
      ['URL Slug', b.seo?.url_slug || p.slug], ['Hauptkeyword', b.seo?.main_keyword],
    ]),
  ];

  const total = Math.round(sections.reduce((a, s) => a + s.score, 0) / sections.length);
  return { total, sections };
}

/** SEO Score 0–100 */
export function pmSeoScore(seo: any, p: any): number {
  const checks = [
    (seo?.seo_title || p?.seo_title || '').length >= 20,
    (seo?.meta_description || p?.seo_description || '').length >= 80,
    !!(seo?.url_slug || p?.slug),
    !!seo?.h1,
    !!seo?.main_keyword,
    (seo?.secondary_keywords || []).length > 0,
    !!seo?.og_title,
    !!seo?.og_image,
    (seo?.faq || []).length > 0,
    !!p?.hero_image_url,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/** Publishing-Checkliste */
export function pmPublishChecks(b: PmBundle): { label: string; ok: boolean }[] {
  const p = b.product || {};
  return [
    { label: 'Pflichtfelder (Name, SKU, Kategorie)', ok: !!p.name && !!p.sku && (p.categories || []).length > 0 },
    { label: 'Preis vorhanden', ok: !!(b.prices?.sale_price_net || b.prices?.rrp_net) },
    { label: 'Hauptbild vorhanden', ok: !!p.hero_image_url || (b.mediaCount || 0) > 0 },
    { label: 'Technische Daten vorhanden', ok: !!p.power || !!p.wavelengths || (b.attrCount || 0) > 0 },
    { label: 'SEO vorhanden', ok: !!(b.seo?.seo_title || p.seo_title) && !!(b.seo?.meta_description || p.seo_description) },
    { label: 'Compliance geprüft', ok: b.compliance?.approval_status === 'approved' },
    { label: 'Marketing freigegeben', ok: !!b.marketing?.approved },
  ];
}

/** Warnungen je Produkt */
export function pmWarnings(b: PmBundle): string[] {
  const p = b.product || {};
  const w: string[] = [];
  if (!b.prices?.sale_price_net && !b.prices?.rrp_net) w.push('Produkt besitzt keinen Preis.');
  if (!p.hero_image_url && !(b.mediaCount || 0)) w.push('Hauptbild fehlt.');
  if (!(b.docCount || 0)) w.push('Bedienungsanleitung fehlt.');
  if (b.compliance?.approval_status !== 'approved') w.push('Compliance nicht freigegeben.');
  if (!(b.seo?.meta_description || p.seo_description)) w.push('SEO Meta Description fehlt.');
  if (b.compliance?.approval_status === 'recheck_required')
    w.push('Technische Angaben wurden nach Compliance-Freigabe geändert.');
  return w;
}

export const pmScoreTone = (n: number) =>
  n >= 90 ? 'text-emerald-500' : n >= 70 ? 'text-amber-500' : 'text-destructive';
