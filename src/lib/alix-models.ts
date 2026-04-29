// Liste aller Alix Lasers & Alix Beauty Geräte
// Quelle: alix_lasers_uebersicht.xlsx

export const ALIX_LASERS_MODELS = [
  'Alix Infinity',
  'Alix Lumina',
  'Alix Shark',
  'Alix Co2-NEX',
  'Alix BlueIce 2 Max KI',
  'Alix Apex',
  'Alix Nexus',
  'Alix Secret Twin',
  'Alix Secret Twin C',
  'Alix Blueice Hybrid Red',
  'Alix Blueice Fusion Red',
  'Alix Saphir',
  'Alix Speed',
  'Alix BlueIce',
  'Alix BlueIce Smart KI',
  'Alix Ergo',
  'Alix Lightforce',
  'Alix iSense',
  'Alix Revita',
  'Alix Carbon Peeling',
  'Alix IPL SHR KI',
  'Alix IPL SHR Pro',
  'ALIX Sculpt IQ',
] as const;

export const ALIX_BEAUTY_MODELS = [
  'Derma Boost',
  'Cold-Warm Plasma',
  'Skin Master',
  'Skin Master Mini',
  'Derma Skin',
  'Detox 5000',
  'Aesthéra',
  'AI Face Scanner',
  'AI Beauty Robot I',
  'Slim 2 KI Smart',
  'Slim IceCool 1',
  'Slim IceCool 2',
  'Glacier Slim X',
  'Beauty Star 4W',
  'Derma 3600',
  'Pro Ice 3W',
  'Eleven 4W',
  'DeepWave',
  'BodyGlow',
  'VelvetVac Ultra',
  'DermiX 12 RF',
  'CelluEX Pro',
] as const;

export const ALIX_MODEL_GROUPS: { label: string; models: readonly string[] }[] = [
  { label: 'Alix Lasers', models: ALIX_LASERS_MODELS },
  { label: 'Alix Beauty', models: ALIX_BEAUTY_MODELS },
];
