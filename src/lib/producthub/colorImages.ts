// Zuordnung Gerätefarbe -> Originalfoto + Farbswatch für die Gerätekonfiguration.
import blauGold from '@/assets/device-colors/Blau-Gold.png.asset.json';
import rotGold from '@/assets/device-colors/Rot-Gold.png.asset.json';
import schwarzGold from '@/assets/device-colors/Schwarz-Gold.png.asset.json';
import schwarzPink from '@/assets/device-colors/Schwarz-Pink.png.asset.json';
import weissGold from '@/assets/device-colors/Weiss-Gld.png.asset.json';

export type DeviceColorVisual = { image: string; swatch: [string, string] };

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ss/g, 's').replace(/[^a-z]/g, '');

const MAP: Record<string, DeviceColorVisual> = {
  blaugold: { image: blauGold.url, swatch: ['#26364f', '#e0b53a'] },
  rotgold: { image: rotGold.url, swatch: ['#a52426', '#cfa257'] },
  schwarzgold: { image: schwarzGold.url, swatch: ['#2c2c2c', '#e0b53a'] },
  schwarzpink: { image: schwarzPink.url, swatch: ['#1a1a1a', '#e7b9c2'] },
  weisgold: { image: weissGold.url, swatch: ['#f4f4f4', '#e0c02a'] },
};

export function deviceColorVisual(color?: string | null): DeviceColorVisual | null {
  if (!color) return null;
  return MAP[norm(color)] ?? null;
}
