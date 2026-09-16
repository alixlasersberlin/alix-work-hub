import { supabase } from "@/integrations/supabase/client";
import { collectDeviceInfo } from "./deviceId";

type Action = {
  ts?: string;
  module: string;
  action: string;
  object_type?: string | null;
  object_id?: string | null;
  duration_ms?: number | null;
  path?: string | null;
  meta?: Record<string, unknown>;
};

class AuditTracker {
  private sessionId: string | null = null;
  private queue: Action[] = [];
  private flushTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private counters = { clicks: 0, scrolls: 0, keystrokes: 0 };
  private lastActivity = Date.now();
  private lastHeartbeat = Date.now();
  private started = false;
  private failureCount = 0;
  private pauseUntil = 0;
  private disabled = false;
  private accessToken: string | null = null;

  /** Audit darf die App nie stören: bei Infrastrukturfehlern komplett abschalten. */
  private isFatal(e: unknown) {
    const msg = String((e as any)?.message ?? e ?? "");
    // Nur echte Infrastrukturfehler abschalten – kurze Netzaussetzer nicht.
    return msg.includes("503") || msg.includes("LOAD_FUNCTION_METADATA_ERROR");
  }



  async start(attempt = 0) {
    if (this.started || this.disabled) return;
    // Ohne echte User-Session würde nur der Anon-Key gesendet -> 401.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    this.accessToken = session.access_token;
    this.started = true;
    try {
      const info = collectDeviceInfo();
      const { data, error } = await supabase.functions.invoke("audit-session-start", { body: info });
      if (error) throw error;
      this.sessionId = (data as any)?.session_id ?? null;
      if (!this.sessionId) throw new Error("no session id");
    } catch (e) {
      // Silent — audit must never break UX. Retry a few times with backoff
      // for transient edge-runtime issues (503 / service degraded).
      console.warn("[audit] session start failed", e);
      this.started = false;
      const msg = String((e as any)?.message ?? e ?? "");
      const unauthorized = msg.includes("401") || msg.toLowerCase().includes("unauthorized");
      if (this.isFatal(e)) { this.disabled = true; return; }
      if (!unauthorized && attempt < 3) {
        const delay = 15_000 * Math.pow(2, attempt);
        window.setTimeout(() => { if (!this.started) this.start(attempt + 1); }, delay);
      }
      return;
    }

    this.attachListeners();
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), 30_000);
    this.flushTimer = window.setInterval(() => this.flush(), 15_000);
    window.addEventListener("beforeunload", this.handleUnload);
  }


  async stop() {
    if (!this.started) return;
    this.started = false;
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.flushTimer) window.clearInterval(this.flushTimer);
    window.removeEventListener("beforeunload", this.handleUnload);
    await this.flush();
    await this.sendHeartbeat();
    if (this.sessionId) {
      try {
        await supabase.functions.invoke("audit-track", {
          body: { session_id: this.sessionId, actions: [], end_session: true },
        });
      } catch {}
    }
    this.sessionId = null;
    this.accessToken = null;
  }

  track(action: Action) {
    if (!this.started) return;
    this.queue.push({ ...action, ts: action.ts ?? new Date().toISOString(), path: action.path ?? location.pathname });
    if (this.queue.length >= 25) this.flush();
  }

  private attachListeners = () => {
    document.addEventListener("click", this.onClick, { capture: true, passive: true });
    document.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    document.addEventListener("keydown", this.onKey, { capture: true, passive: true });
    document.addEventListener("mousemove", this.onMove, { capture: true, passive: true });
  };

  private onClick = () => { this.counters.clicks++; this.lastActivity = Date.now(); };
  private onScroll = () => { this.counters.scrolls++; this.lastActivity = Date.now(); };
  private onKey = () => { this.counters.keystrokes++; this.lastActivity = Date.now(); };
  private onMove = () => { this.lastActivity = Date.now(); };

  private async sendHeartbeat() {
    if (!this.sessionId || !this.started || this.disabled) return;
    if (Date.now() < this.pauseUntil) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { await this.stop(); return; }
    this.accessToken = session.access_token;

    const now = Date.now();
    const elapsedSec = Math.round((now - this.lastHeartbeat) / 1000);
    const idleThresholdMs = 60_000;
    const isIdle = now - this.lastActivity > idleThresholdMs;
    const activeDelta = isIdle ? 0 : elapsedSec;
    const idleDelta = isIdle ? elapsedSec : 0;
    const payload = {
      session_id: this.sessionId,
      active_delta: activeDelta,
      idle_delta: idleDelta,
      clicks: this.counters.clicks,
      scrolls: this.counters.scrolls,
      keystrokes: this.counters.keystrokes,
    };
    this.counters = { clicks: 0, scrolls: 0, keystrokes: 0 };
    this.lastHeartbeat = now;
    try {
      // Heartbeats share the stable audit batch endpoint. This avoids a second
      // high-frequency worker whose metadata load could intermittently fail.
      const { error } = await supabase.functions.invoke("audit-track", {
        body: { session_id: this.sessionId, actions: [], heartbeat: payload },
      });
      if (error) {
        const msg = String((error as any)?.message ?? "");
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          await this.stop();
          return;
        }
        // Infrastrukturfehler (503 / Funktion nicht ladbar): Audit still abschalten
        if (this.isFatal(error)) { this.disabled = true; await this.stop(); return; }
        this.failureCount++;
        if (this.failureCount >= 3) {
          this.pauseUntil = Date.now() + 5 * 60_000;
          this.failureCount = 0;
        }
        return;
      }
      this.failureCount = 0;
    } catch (e) {
      if (this.isFatal(e)) { this.disabled = true; await this.stop(); return; }
      this.failureCount++;
      if (this.failureCount >= 3) {
        this.pauseUntil = Date.now() + 5 * 60_000;
        this.failureCount = 0;
      }
    }
  }


  private async flush() {
    if (!this.sessionId || this.queue.length === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { this.queue = []; await this.stop(); return; }
    this.accessToken = session.access_token;

    const batch = this.queue.splice(0, 100);
    try {
      const { error } = await supabase.functions.invoke("audit-track", { body: { session_id: this.sessionId, actions: batch } });
      if (error) {
        const msg = String((error as any)?.message ?? "");
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          this.queue = [];
          await this.stop();
        }
      }
    } catch {
      // Requeue on failure (bounded)
      this.queue.unshift(...batch.slice(0, 50));
    }
  }

  private handleUnload = () => {
    if (!this.sessionId || !this.accessToken) return;
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-track`;
      void fetch(url, {
        method: "POST",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: this.sessionId, actions: [], end_session: true }),
      }).catch(() => undefined);
    } catch {}
  };
}

export const auditTracker = new AuditTracker();

export function trackAudit(action: Action) { auditTracker.track(action); }
