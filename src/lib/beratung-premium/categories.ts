// Kategorie-/Gerätezuordnung für die Premium-Beratung (/beratung/premium).
// Nutzt ausschliesslich bestehende Gerätenamen aus src/lib/alix-models.ts.

import imgHair from '@/assets/wizard-premium/haarentfernung.jpg';
import imgSkin from '@/assets/wizard-premium/haut.jpg';
import imgBody from '@/assets/wizard-premium/koerper.jpg';
import imgTattoo from '@/assets/wizard-premium/tattoo.jpg';
import devHair from '@/assets/wizard-premium/device-haarentfernung.jpg';
import devSkin from '@/assets/wizard-premium/device-haut.jpg';
import devBody from '@/assets/wizard-premium/device-koerper.jpg';
import devTattoo from '@/assets/wizard-premium/device-tattoo.jpg';

export type PremiumCategory =
  | 'Haarentfernung'
  | 'Haut & Anti Aging'
  | 'Körper & Abnehmen'
  | 'Tattoo & Pigment';

export type PremiumDevice = {
  name: string;
  features: [string, string, string];
};

export type PremiumCategoryDef = {
  key: PremiumCategory;
  no: string;
  desc: string;
  img: string;
  /** Produktfoto für die Gerätekarten dieser Kategorie. */
  deviceImg: string;
  /** Tailwind gradient tokens für die visuelle Welt der Kategorie. */
  world: string;
  devices: PremiumDevice[];
};

export const PREMIUM_CATEGORIES: PremiumCategoryDef[] = [
  {
    key: 'Haarentfernung',
    no: '01',
    desc: 'Dauerhafte Haarreduktion mit Dioden- und SHR-Technologie.',
    img: imgHair,
    deviceImg: devHair,
    world: 'from-[#f7f9fb] via-[#eef4f8] to-[#e2edf5]',
    devices: [
      { name: 'Alix BlueIce Smart KI', features: ['KI-gestützte Parametrik', 'Kontaktkühlung', 'Hohe Behandlungsgeschwindigkeit'] },
      { name: 'Alix BlueIce 2 Max KI', features: ['Maximale Leistung', 'Grossflächiger Spot', 'Smart-KI-Steuerung'] },
      { name: 'Alix BlueIce', features: ['Bewährte Dioden-Technologie', 'Effiziente Kühlung', 'Einfache Bedienung'] },
      { name: 'Alix Lumina', features: ['Multiwellenlänge', 'Premium-Handstück', 'Hoher Patientenkomfort'] },
      { name: 'Alix IPL SHR KI', features: ['SHR-Modus', 'KI-Hauttyp-Erkennung', 'Kurze Behandlungszeit'] },
      { name: 'Alix Speed', features: ['Sehr schnelle Sessions', 'Kompaktes Design', 'Wartungsarm'] },
    ],
  },
  {
    key: 'Haut & Anti Aging',
    no: '02',
    desc: 'Hautbild, Straffung und Regeneration auf medizinischem Niveau.',
    img: imgSkin,
    deviceImg: devSkin,
    world: 'from-[#fdfbf7] via-[#f7f1e6] to-[#efe6d6]',
    devices: [
      { name: 'Alix Secret Twin', features: ['Fraktionierte RF-Microneedling', 'Zwei Handstücke', 'Präzise Tiefensteuerung'] },
      { name: 'Alix Co2-NEX', features: ['Fraktionierter CO2-Laser', 'Skin Resurfacing', 'Vielseitige Modi'] },
      { name: 'Alix HIFU 12D Pro', features: ['12D-Fokussierter Ultraschall', 'Lifting ohne OP', 'Mehrere Kartuschen'] },
      { name: 'Alix Revita', features: ['Regenerationsprotokolle', 'Sanfte Anwendung', 'Sichtbare Hautverbesserung'] },
      { name: 'Alix Carbon Peeling', features: ['Carbon-Peel-Modus', 'Porenverfeinerung', 'Schnelle Sessions'] },
      { name: 'Skin Master', features: ['Multifunktions-Plattform', 'Analyse & Pflege', 'Modularer Aufbau'] },
    ],
  },
  {
    key: 'Körper & Abnehmen',
    no: '03',
    desc: 'Body Contouring, Cellulite und Fettreduktion.',
    img: imgBody,
    deviceImg: devBody,
    world: 'from-[#fafafa] via-[#eceef0] to-[#dfe3e6]',
    devices: [
      { name: 'ALIX Sculpt IQ', features: ['Muskelstimulation', 'Intelligente Programme', 'Mehrere Applikatoren'] },
      { name: 'Slim 2 KI Smart', features: ['KI-Programme', 'Kryo-Technologie', 'Komfortable Anwendung'] },
      { name: 'Glacier Slim X', features: ['Kryolipolyse', 'Grossflächige Applikatoren', 'Kurze Zykluszeiten'] },
      { name: 'DeepWave', features: ['Tiefenwirksame Wellen', 'Cellulite-Protokolle', 'Straffungseffekt'] },
      { name: 'CelluEX Pro', features: ['Cellulite-Fokus', 'Vakuum & Massage', 'Individuelle Programme'] },
      { name: 'VelvetVac Ultra', features: ['Vakuumtherapie', 'Lymph-Programme', 'Sanftes Handling'] },
    ],
  },
  {
    key: 'Tattoo & Pigment',
    no: '04',
    desc: 'Tattooentfernung und Pigmentkorrektur mit Q-Switch-Technologie.',
    img: imgTattoo,
    deviceImg: devTattoo,
    world: 'from-[#f4f5f6] via-[#e6e8ea] to-[#d3d7db]',
    devices: [
      { name: 'Alix Shark', features: ['Q-Switch-Technologie', 'Mehrere Wellenlängen', 'Hohe Spitzenleistung'] },
      { name: 'Alix Apex', features: ['Pigmentkorrektur', 'Präzise Spotgrössen', 'Robuste Bauweise'] },
      { name: 'Alix Nexus', features: ['Multiindikation', 'Schnelle Repetitionsrate', 'Premium-Optik'] },
      { name: 'Alix Saphir', features: ['Feine Pigmentarbeit', 'Stabile Energieabgabe', 'Kompaktes Gehäuse'] },
      { name: 'Alix Lumina', features: ['Multiwellenlänge', 'Kombinierbare Protokolle', 'Hoher Komfort'] },
    ],
  },
];

export function devicesForCategory(cat: PremiumCategory | ''): PremiumDevice[] {
  return PREMIUM_CATEGORIES.find((c) => c.key === cat)?.devices ?? [];
}

export function deviceImageForCategory(cat: PremiumCategory | ''): string | null {
  return PREMIUM_CATEGORIES.find((c) => c.key === cat)?.deviceImg ?? null;
}
