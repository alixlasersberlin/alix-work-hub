// ALIXWORK PRODUCT HUB – zentrale Konfiguration (additiv, greift nicht in bestehende Module ein)

export const PH_CHANNELS = [
  { code: 'com', label: 'alix-lasers.com', short: 'COM' },
  { code: 'de', label: 'alix-lasers.de', short: 'DE' },
  { code: 'at', label: 'alix-lasers.at', short: 'AT' },
  { code: 'usa', label: 'alix-lasers.us', short: 'USA' },
  { code: 'dubai', label: 'alix-lasers.ae', short: 'DUBAI' },
] as const;

export const PH_ACTIVE_FIELD: Record<string, string> = {
  com: 'active_com', de: 'active_de', at: 'active_at', usa: 'active_usa', dubai: 'active_dubai',
};

export const PH_STATUS = ['draft', 'review', 'approved', 'published', 'archived'] as const;

export const PH_APPLICATIONS = [
  'Haarentfernung',
  'Haut & Anti Aging',
  'Körper & Abnehmen',
  'Tattoo & Pigment',
  'Alexandrit',
  'Kombisysteme',
] as const;

export const PH_MEDIA_KINDS = [
  'hero', 'front', 'side', 'detail', 'application', 'lifestyle', 'technical', 'social',
  'gallery', 'video',
] as const;

export const PH_DOC_TYPES = [
  'Bedienungsanleitung', 'Service Manual', 'Technical File', 'Datenblatt', 'Risikomanagement',
  'Software-Dokumentation', 'CE Dokument', 'MDR Dokument', 'ISO Dokument', 'Zertifikat',
  'Label', 'Prüfbericht',
] as const;

export const PH_DOC_VISIBILITY = ['internal', 'service', 'customer', 'website', 'regulatory'] as const;

export const PH_ROLES = ['Product Admin', 'Regulatory', 'Marketing', 'Sales', 'Service', 'Admin'] as const;

/** Kritische Felder – Änderungen werden protokolliert und benötigen Regulatory-Review */
export const PH_CRITICAL_FIELDS = [
  'wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes', 'cooling',
  'laser_class', 'intended_use', 'manufacturer', 'mdr_status', 'ce_status', 'iso_status', 'standards',
];

export const PH_FIELD_LABELS: Record<string, string> = {
  alix_product_id: 'ALIX Product ID', source_product_id: 'Quell-ID', name: 'Produktname',
  internal_name: 'Interne Bezeichnung', model: 'Modell', sku: 'SKU', slug: 'Slug', status: 'Status',
  product_group: 'Produktgruppe', categories: 'Kategorien', applications: 'Anwendungen',
  short_description: 'Kurzbeschreibung', long_description: 'Langbeschreibung', features: 'Features',
  smart_ki: 'Smart KI', tech_specs: 'Technische Daten', wavelengths: 'Wellenlängen', power: 'Leistung',
  fluence: 'Fluence', pulse_duration: 'Pulsdauer', frequency: 'Frequenz', spot_sizes: 'Spotgrößen',
  cooling: 'Kühlung', laser_class: 'Laserklasse', intended_use: 'Zweckbestimmung',
  manufacturer: 'Hersteller', production_site: 'Produktionsstandort', ce_status: 'CE Status',
  mdr_status: 'MDR Status', iso_status: 'ISO Status', standards: 'Normen', hero_image_url: 'Hauptbild',
  seo_title: 'SEO Titel', seo_description: 'SEO Beschreibung', sort_order: 'Sortierung',
  featured: 'Featured', protected: 'Geschützt', manual_override: 'Manual Override',
  active_de: 'Aktiv DE', active_com: 'Aktiv COM', active_at: 'Aktiv AT', active_usa: 'Aktiv USA',
  active_dubai: 'Aktiv Dubai', notes: 'Notizen',
};

export const phLabel = (k: string) => PH_FIELD_LABELS[k] || k;

export interface PhProduct {
  id: string;
  alix_product_id: string | null;
  source_product_id: string | null;
  name: string;
  internal_name: string | null;
  model: string | null;
  sku: string | null;
  slug: string | null;
  status: string;
  product_group: string | null;
  categories: string[];
  applications: string[];
  short_description: string | null;
  long_description: string | null;
  features: any;
  smart_ki: any;
  tech_specs: any;
  wavelengths: string | null;
  power: string | null;
  fluence: string | null;
  pulse_duration: string | null;
  frequency: string | null;
  spot_sizes: string | null;
  cooling: string | null;
  laser_class: string | null;
  intended_use: string | null;
  manufacturer: string | null;
  production_site: string | null;
  ce_status: string | null;
  mdr_status: string | null;
  iso_status: string | null;
  standards: string[];
  hero_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
  featured: boolean;
  protected: boolean;
  manual_override: boolean;
  active_de: boolean;
  active_com: boolean;
  active_at: boolean;
  active_usa: boolean;
  active_dubai: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PhTone = 'green' | 'amber' | 'red' | 'blue';

/** Ampellogik: 🟢 vollständig · 🟡 Review/Daten fehlen · 🔴 Konflikt · 🔵 Änderung wartet */
export function phTone(p: Partial<PhProduct>, ctx: {
  conflicts?: number; media?: number; documents?: number; pending?: boolean;
} = {}): { tone: PhTone; label: string } {
  if ((ctx.conflicts || 0) > 0) return { tone: 'red', label: 'Konflikt' };
  if (ctx.pending) return { tone: 'blue', label: 'Veröffentlichung offen' };
  const missing =
    !p.model || !p.short_description || !p.wavelengths || !p.power || !p.mdr_status ||
    !(ctx.media && ctx.media > 0) || !(ctx.documents && ctx.documents > 0) || p.status === 'review';
  if (missing) return { tone: 'amber', label: 'Review / unvollständig' };
  return { tone: 'green', label: 'Vollständig' };
}

export const phToneClass = (t: PhTone) =>
  t === 'green' ? 'bg-emerald-500' : t === 'amber' ? 'bg-amber-500' : t === 'red' ? 'bg-destructive' : 'bg-sky-500';

export const phSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const phNormName = (s?: string | null) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
