/**
 * ALIXWORK Performance Probe (Phase 1 – Messung)
 *
 * Misst jede HTTP-Anfrage gegen Supabase (PostgREST, RPC, Edge Functions)
 * direkt im Browser und legt die Ergebnisse in einem Ringpuffer ab.
 * Das Performance Center liest daraus die Live-Antwortzeiten pro Modul.
 *
 * Bewusst als globaler fetch-Wrapper umgesetzt: so muss keine einzelne
 * Abfrage im Code instrumentiert werden und es entstehen keine Regressionen.
 */

export type PerfSample = {
  id: number;
  /** Tabelle, RPC-Name oder Edge-Function */
  target: string;
  kind: 'table' | 'rpc' | 'function' | 'auth' | 'storage' | 'other';
  method: string;
  ms: number;
  status: number;
  /** Antwortgröße in Bytes (soweit ermittelbar) */
  bytes: number | null;
  /** Anzahl Datensätze, aus dem Content-Range-Header */
  rows: number | null;
  /** Route der App zum Zeitpunkt der Abfrage – ergibt „Antwortzeit pro Modul“ */
  route: string;
  at: number;
};

const MAX_SAMPLES = 500;
const buffer: PerfSample[] = [];
const listeners = new Set<() => void>();
let seq = 0;
let installed = false;

function emit() {
  listeners.forEach((l) => {
    try { l(); } catch { /* ignore */ }
  });
}

export function getPerfSamples(): PerfSample[] {
  return buffer;
}

export function clearPerfSamples() {
  buffer.length = 0;
  emit();
}

export function subscribePerfSamples(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function classify(url: string): { target: string; kind: PerfSample['kind'] } | null {
  const i = url.indexOf('/rest/v1/');
  if (i >= 0) {
    const rest = url.slice(i + '/rest/v1/'.length).split('?')[0];
    if (rest.startsWith('rpc/')) return { target: rest.slice(4), kind: 'rpc' };
    if (!rest) return null;
    return { target: rest, kind: 'table' };
  }
  const f = url.indexOf('/functions/v1/');
  if (f >= 0) return { target: url.slice(f + '/functions/v1/'.length).split('?')[0], kind: 'function' };
  const s = url.indexOf('/storage/v1/');
  if (s >= 0) return { target: 'storage', kind: 'storage' };
  const a = url.indexOf('/auth/v1/');
  if (a >= 0) return { target: 'auth', kind: 'auth' };
  return null;
}

function parseRows(contentRange: string | null): number | null {
  // Format: "0-49/3269" oder "*/3269"
  if (!contentRange) return null;
  const part = contentRange.split('/')[0];
  if (!part || part === '*') return null;
  const [from, to] = part.split('-').map(Number);
  if (Number.isFinite(from) && Number.isFinite(to)) return to - from + 1;
  return null;
}

/** Installiert den Probe-Wrapper. Mehrfachaufrufe sind unschädlich. */
export function installQueryProbe() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;

  const supabaseHost = (() => {
    try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).host; } catch { return null; }
  })();

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    let relevant = false;
    try { relevant = !!supabaseHost && new URL(url, window.location.origin).host === supabaseHost; } catch { /* ignore */ }
    if (!relevant) return originalFetch(input as RequestInfo, init);

    const info = classify(url);
    if (!info) return originalFetch(input as RequestInfo, init);

    const t0 = performance.now();
    try {
      const res = await originalFetch(input as RequestInfo, init);
      const ms = performance.now() - t0;
      const len = res.headers.get('content-length');
      buffer.push({
        id: ++seq,
        target: info.target,
        kind: info.kind,
        method: (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase(),
        ms: Math.round(ms),
        status: res.status,
        bytes: len ? Number(len) : null,
        rows: parseRows(res.headers.get('content-range')),
        route: window.location.pathname,
        at: Date.now(),
      });
      if (buffer.length > MAX_SAMPLES) buffer.splice(0, buffer.length - MAX_SAMPLES);
      emit();
      return res;
    } catch (err) {
      const ms = performance.now() - t0;
      buffer.push({
        id: ++seq,
        target: info.target,
        kind: info.kind,
        method: (init?.method || 'GET').toUpperCase(),
        ms: Math.round(ms),
        status: 0,
        bytes: null,
        rows: null,
        route: window.location.pathname,
        at: Date.now(),
      });
      if (buffer.length > MAX_SAMPLES) buffer.splice(0, buffer.length - MAX_SAMPLES);
      emit();
      throw err;
    }
  };
}
