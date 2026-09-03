// Gemeinsame Telefonnummer-Normalisierung (E.164) für AlixSmart-/Inbox-Abgleiche.
// Konservativ: nur eindeutige Fälle werden konvertiert, sonst null.

const DEFAULT_CC = "49"; // Deutschland

export function toE164(raw: string | null | undefined, defaultCc = DEFAULT_CC): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Klammern, Bindestriche, Leerzeichen, Schrägstriche entfernen
  s = s.replace(/[\s\-().\u00a0/]/g, "");
  // 00-Präfix → +
  if (s.startsWith("00")) s = "+" + s.slice(2);

  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return "+" + digits;
  }

  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  // Dummy-/Testnummern verwerfen
  if (/^(0+|1+|5+|9+)$/.test(digits)) return null;

  if (digits.startsWith("0")) {
    const national = digits.replace(/^0+/, "");
    if (national.length < 6 || national.length > 14) return null;
    return "+" + defaultCc + national;
  }

  // Nummer bereits mit Ländercode ohne +
  if (digits.length >= 10 && digits.length <= 15 && digits.startsWith(defaultCc)) {
    return "+" + digits;
  }
  // Nationale Nummer ohne führende 0 (z. B. 1605165555)
  if (digits.length >= 9 && digits.length <= 12) return "+" + defaultCc + digits;

  return null;
}

/** Vergleichbare Varianten einer Nummer (für OR-Filter gegen unnormalisierte Altbestände). */
export function phoneVariants(value: string | null | undefined, defaultCc = DEFAULT_CC): string[] {
  const e164 = toE164(value, defaultCc);
  if (!e164) return [];
  const digits = e164.slice(1);
  const out = new Set<string>([e164, digits, "00" + digits]);
  if (digits.startsWith(defaultCc)) out.add("0" + digits.slice(defaultCc.length));
  return [...out];
}
