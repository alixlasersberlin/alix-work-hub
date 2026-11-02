/** Trim pasted whitespace without silently changing the intended address. */
export function normalizeUserEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254 || !/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email)) return null;
  return email;
}

export function userCreationAuthError(message: string): string {
  if (/Unable to validate email|email.*invalid|invalid.*email/i.test(message)) {
    return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  }
  return message || 'Benutzer konnte nicht angelegt werden.';
}