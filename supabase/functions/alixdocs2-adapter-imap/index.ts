// AlixDocs 2.0 – IMAP adapter (scaffold)
// Implements the SourceAdapter interface from _shared/alixdocs2-adapters.ts.
// Requires IMAP credentials to be stored via secrets (IMAP_HOST/USER/PASS)
// before it can be wired into the scanner pipeline.

import type { SourceAdapter, RemoteFile } from "../_shared/alixdocs2-adapters.ts";

export const imapAdapter: SourceAdapter = {
  id: "imap",
  label: "IMAP (E-Mail-Anhänge)",

  async test(): Promise<{ ok: boolean; message: string }> {
    const host = Deno.env.get("IMAP_HOST");
    const user = Deno.env.get("IMAP_USER");
    const pass = Deno.env.get("IMAP_PASS");
    if (!host || !user || !pass) {
      return { ok: false, message: "IMAP_HOST/USER/PASS Secrets fehlen." };
    }
    // TODO: perform real IMAP LOGIN handshake (deno-imap not yet installed)
    return { ok: true, message: `Scaffold OK für ${user}@${host}` };
  },

  async list(): Promise<RemoteFile[]> {
    // TODO: fetch unread messages from INBOX and yield attachments
    return [];
  },

  async download(_file: RemoteFile): Promise<Uint8Array> {
    throw new Error("imap.download not implemented yet");
  },
};
