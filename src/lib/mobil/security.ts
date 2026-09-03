/**
 * ALIXWORK MOBILE – Prompt 7: Security-Schicht (Client)
 *
 * Grundsätze:
 * - Keine Secrets, keine Tokens, keine PIN im Klartext im Client-Speicher.
 * - Die PIN wird ausschliesslich als PBKDF2-Hash (mit Zufalls-Salt) lokal gehalten;
 *   sie ist reiner App-Lock und ersetzt keine Server-Authentifizierung.
 * - Biometrie nutzt ausschliesslich die Plattform-Schnittstelle (WebAuthn /
 *   Face ID / Touch ID / Android Biometrics). Es werden niemals biometrische
 *   Templates gespeichert – nur eine Credential-ID.
 * - Die Session-Wahrheit bleibt Supabase Auth + RLS. Der App-Lock verdeckt nur
 *   lokal die Oberfläche.
 */
import { supabase } from '@/integrations/supabase/client';

const K_DEVICE_ID = 'alix.mobile.deviceId';
const K_PIN = 'alix.mobile.pin'; // { salt, hash, iter }
const K_BIO = 'alix.mobile.bioCredId';
const K_AUTOLOCK = 'alix.mobile.autoLockMinutes';
const K_LOCKED_AT = 'alix.mobile.lastActiveAt';
const K_PREVIEW = 'alix.mobile.pushPreview';

export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 30] as const;
export const DEFAULT_AUTO_LOCK = 5;

/* ------------------------------------------------------------------ Device */

export function getDeviceId(): string {
  let id = localStorage.getItem(K_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(K_DEVICE_ID, id);
  }
  return id;
}

export function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Web';
}

export function deviceName(): string {
  const ua = navigator.userAgent;
  const model = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android-Gerät' : detectPlatform();
  return `${model} · ${navigator.language}`;
}

/** Registriert/aktualisiert das Gerät (kein PIN-/Biometrie-Material serverseitig). */
export async function touchTrustedDevice(appVersion: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await (supabase as any).from('trusted_devices').upsert(
    {
      user_id: uid,
      device_id: getDeviceId(),
      device_name: deviceName(),
      platform: detectPlatform(),
      app_version: appVersion,
      trusted: true,
      biometric_enabled: hasBiometric(),
      pin_enabled: hasPin(),
      auto_lock_minutes: getAutoLockMinutes(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: 'user_id,device_id' },
  );
}

export type MobileDevice = {
  device_id: string;
  device_name: string | null;
  platform: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  biometric_enabled: boolean;
  pin_enabled: boolean;
  push_registered: boolean;
  revoked_at: string | null;
  is_current: boolean;
};

export async function listMyDevices(): Promise<MobileDevice[]> {
  const { data, error } = await (supabase as any).rpc('mobile_my_devices');
  if (error) throw error;
  const cur = getDeviceId();
  return ((data ?? []) as MobileDevice[]).map((d) => ({ ...d, is_current: d.device_id === cur }));
}

export async function revokeDevice(deviceId: string) {
  const { error } = await (supabase as any).rpc('mobile_revoke_devices', {
    _device_id: deviceId,
    _all_others: false,
    _current_device_id: getDeviceId(),
  });
  if (error) throw error;
}

export async function revokeAllOtherDevices() {
  const { error } = await (supabase as any).rpc('mobile_revoke_devices', {
    _device_id: null,
    _all_others: true,
    _current_device_id: getDeviceId(),
  });
  if (error) throw error;
}

/* --------------------------------------------------------------- App-PIN */

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPin(): boolean {
  return !!localStorage.getItem(K_PIN);
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN muss 4–6 Ziffern haben.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iter = 150_000;
  const hash = await pbkdf2(pin, salt, iter);
  localStorage.setItem(
    K_PIN,
    JSON.stringify({ salt: Array.from(salt), hash, iter }),
  );
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(K_PIN);
  if (!raw) return false;
  try {
    const { salt, hash, iter } = JSON.parse(raw);
    const calc = await pbkdf2(pin, new Uint8Array(salt), iter);
    return calc === hash;
  } catch {
    return false;
  }
}

export function clearPin() {
  localStorage.removeItem(K_PIN);
}

/* ------------------------------------------------------------- Biometrie */

export async function biometricSupported(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await (window.PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasBiometric(): boolean {
  return !!localStorage.getItem(K_BIO);
}

/** Legt ein Plattform-Credential an (Face ID / Touch ID / Android Biometrics). */
export async function enableBiometric(userId: string, userLabel: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'AlixWork', id: window.location.hostname },
      user: { id: new TextEncoder().encode(userId), name: userLabel, displayName: userLabel },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Biometrie wurde abgebrochen.');
  const id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
  localStorage.setItem(K_BIO, id);
}

export function disableBiometric() {
  localStorage.removeItem(K_BIO);
}

/** Entsperrt per Betriebssystem-Biometrie. Kein Token, keine Templates. */
export async function unlockWithBiometric(): Promise<boolean> {
  const stored = localStorage.getItem(K_BIO);
  if (!stored) return false;
  try {
    const rawId = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: rawId }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- Auto-Lock */

export function getAutoLockMinutes(): number {
  const raw = localStorage.getItem(K_AUTOLOCK);
  const n = raw === null ? DEFAULT_AUTO_LOCK : Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_AUTO_LOCK;
}

export function setAutoLockMinutes(m: number) {
  localStorage.setItem(K_AUTOLOCK, String(m));
}

export function markActivity() {
  localStorage.setItem(K_LOCKED_AT, String(Date.now()));
}

export function lockRequired(): boolean {
  if (!hasPin() && !hasBiometric()) return false;
  const minutes = getAutoLockMinutes();
  const last = Number(localStorage.getItem(K_LOCKED_AT) || 0);
  if (!last) return true;
  if (minutes === 0) return true;
  return Date.now() - last > minutes * 60_000;
}

/* ------------------------------------------------- Push-Vorschau / Cache */

export function pushPreviewEnabled(): boolean {
  return localStorage.getItem(K_PREVIEW) !== 'off';
}

export function setPushPreview(on: boolean) {
  localStorage.setItem(K_PREVIEW, on ? 'on' : 'off');
}

/** Entfernt sensible lokale Daten (Logout / Session-Widerruf). PIN & Biometrie bleiben gerätegebunden nur, wenn gewünscht. */
export function wipeLocalSensitiveData(opts: { keepUnlockMethods?: boolean } = {}) {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith('mobil:') || k.startsWith('alix.cache.')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  if (!opts.keepUnlockMethods) {
    clearPin();
    disableBiometric();
  }
  localStorage.removeItem(K_LOCKED_AT);
}

/* ------------------------------------------------------------- Maskierung */

export function maskPhone(v?: string | null): string {
  if (!v) return '—';
  const s = String(v).replace(/\s+/g, '');
  if (s.length < 5) return '***';
  return `${s.slice(0, 3)}${'*'.repeat(Math.max(0, s.length - 7))}${s.slice(-4)}`;
}

export function maskEmail(v?: string | null): string {
  if (!v || !v.includes('@')) return '—';
  const [a, b] = v.split('@');
  return `${a.slice(0, 1)}***@${b}`;
}
