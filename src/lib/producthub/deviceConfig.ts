// Gerätekonfiguration je Angebots-/Auftragsposition (Farbe + Lasermodul-Leistung).
// Die verfügbaren Werte kommen aus dem Product Hub (ph_products.config_colors / config_powers),
// die Auswahl wird als Snapshot an der jeweiligen Position gespeichert.

export const PH_DEFAULT_COLORS = [
  'Blau / Gold',
  'Schwarz / Gold',
  'Weiß / Gold',
  'Schwarz / Pink',
  'Rot / Gold',
  'Sonderfarbe RAL',
] as const;

export const PH_DEFAULT_POWERS = ['1600 W', '2000 W', '2400 W', '3000 W'] as const;

export const PH_RAL_OPTION = 'Sonderfarbe RAL';

export type DeviceConfig = {
  product_id?: string | null;
  product_name?: string | null;
  device_color?: string | null;
  ral_color_code?: string | null;
  laser_module_power?: string | null;
};

export const isRalColor = (c?: string | null) => (c || '').toLowerCase().includes('ral');

export function deviceConfigComplete(cfg: DeviceConfig): boolean {
  if (!cfg.device_color || !cfg.laser_module_power) return false;
  if (isRalColor(cfg.device_color) && !(cfg.ral_color_code || '').trim()) return false;
  return true;
}

/** Mehrzeilige Darstellung für Angebot, PDF und Auftrag. */
export function deviceConfigLines(cfg: DeviceConfig): string[] {
  const out: string[] = [];
  if (cfg.device_color) {
    if (isRalColor(cfg.device_color)) {
      out.push('Farbe: Sonderfarbe');
      if (cfg.ral_color_code) out.push(`RAL: ${cfg.ral_color_code}`);
    } else {
      out.push(`Farbe: ${cfg.device_color}`);
    }
  }
  if (cfg.laser_module_power) out.push(`Leistung Lasermodul: ${cfg.laser_module_power}`);
  return out;
}

export const deviceConfigText = (cfg: DeviceConfig) => deviceConfigLines(cfg).join('\n');
