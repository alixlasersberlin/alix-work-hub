/** Same strict normalization is used in the browser and the send boundary. */
export function smsPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40 || !/^[+\d\s().-]+$/.test(raw)) return null;
  let phone = raw.trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  else if (phone.startsWith('0')) phone = '+49' + phone.slice(1);
  else if (!phone.startsWith('+')) phone = '+' + phone;
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}
export function smsReview(requested: unknown, stored: unknown[], canOverride: boolean, confirmed: unknown, reason: unknown) {
  const phone = smsPhone(requested);
  if (!phone) return { error: 'Ungültige Mobilnummer', status: 400 } as const;
  const alternative = !stored.some(s => smsPhone(s) === phone);
  if (!alternative) return { phone, alternative, reason: null };
  if (!canOverride) return { error: 'Keine Berechtigung für abweichende Telefonnummer', status: 403 } as const;
  if (confirmed !== true) return { error: 'Abweichende Telefonnummer ausdrücklich bestätigen', status: 400 } as const;
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) return { error: 'Grund für abweichende Telefonnummer erforderlich (maximal 500 Zeichen)', status: 400 } as const;
  return { phone, alternative, reason: reason.trim() };
}