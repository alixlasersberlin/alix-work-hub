// Entschlüsselung für ALIX-Backup-Dateien (*.zip.enc)
// Format: "ALIXBK1" | salt(16) | iv(12) | AES-256-GCM Ciphertext
const MAGIC = 'ALIXBK1';
const PBKDF2_ITERATIONS = 310_000;

export async function decryptBackupFile(file: File, password: string): Promise<Blob> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const magic = new TextDecoder().decode(buf.slice(0, MAGIC.length));
  if (magic !== MAGIC) {
    throw new Error('Ungültige Datei – kein ALIX-Backup-Container.');
  }
  const salt = buf.slice(MAGIC.length, MAGIC.length + 16);
  const iv = buf.slice(MAGIC.length + 16, MAGIC.length + 28);
  const cipher = buf.slice(MAGIC.length + 28);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new Blob([plain], { type: 'application/zip' });
  } catch {
    throw new Error('Entschlüsselung fehlgeschlagen – falsches Passwort oder beschädigte Datei.');
  }
}

/** Mindestanforderung: 16 Zeichen, Groß/Klein, Ziffer, Sonderzeichen */
export function backupPasswordError(pw: string): string | null {
  if (pw.length < 16) return 'Mindestens 16 Zeichen erforderlich.';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 4) return 'Groß-, Kleinbuchstaben, Ziffern und Sonderzeichen erforderlich.';
  return null;
}
