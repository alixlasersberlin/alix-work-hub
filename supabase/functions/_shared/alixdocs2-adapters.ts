// AlixDocs AI 2.0 — Source Adapter Interface (Phase 9)
// Common contract for all document sources (Nextcloud, IMAP, Graph, GDrive,
// Dropbox, SharePoint, Scanner, WhatsApp, …). New sources implement this
// interface; the core pipeline (analyze → match → store) stays untouched.

export type AdapterKind =
  | 'nextcloud' | 'imap' | 'graph' | 'gdrive'
  | 'dropbox' | 'sharepoint' | 'scanner' | 'whatsapp';

export interface RemoteFile {
  path: string;           // stable remote identifier (e.g. WebDAV path, message-id, drive item id)
  name: string;
  size: number;
  mime: string;
  etag: string;           // change token; if unchanged → skip
  modified_at: string;    // ISO
  metadata?: Record<string, unknown>;
}

export interface AdapterContext {
  server_id: string;      // row in alixdocs2_nc_servers (or per-adapter table later)
  folder_id: string;      // row in alixdocs2_nc_watched_folders
  base_path: string;
  credentials: Record<string, string>;  // resolved from secrets, never persisted
}

export interface SourceAdapter {
  kind: AdapterKind;
  /** Test connectivity + auth. */
  test(ctx: AdapterContext): Promise<{ ok: boolean; message: string }>;
  /** List remote files under `ctx.base_path` (recursive). */
  list(ctx: AdapterContext): Promise<RemoteFile[]>;
  /** Download the file bytes for OCR / preview. */
  download(ctx: AdapterContext, file: RemoteFile): Promise<ArrayBuffer>;
}

const registry = new Map<AdapterKind, SourceAdapter>();
export function registerAdapter(a: SourceAdapter) { registry.set(a.kind, a); }
export function getAdapter(kind: AdapterKind): SourceAdapter | undefined { return registry.get(kind); }
export function listAdapters(): AdapterKind[] { return Array.from(registry.keys()); }
