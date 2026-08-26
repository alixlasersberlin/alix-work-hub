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


  async start(attempt = 0) {
    if (this.started) return;
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
      if (attempt < 3) {
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
      try { await supabase.functions.invoke("audit-session-end", { body: { session_id: this.sessionId } }); } catch {}
    }
    this.sessionId = null;
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
    if (!this.sessionId || !this.started) return;
    if (Date.now() < this.pauseUntil) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { await this.stop(); return; }
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
      const { error } = await supabase.functions.invoke("audit-session-heartbeat", { body: payload });
      if (error) {
        const msg = String((error as any)?.message ?? "");
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          await this.stop();
          return;
        }
        // Transient backend issues (503 / service degraded): back off instead of hammering
        this.failureCount++;
        if (this.failureCount >= 3) {
          this.pauseUntil = Date.now() + 5 * 60_000;
          this.failureCount = 0;
        }
        return;
      }
      this.failureCount = 0;
    } catch {
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
    if (!this.sessionId) return;
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-session-end`;
      const blob = new Blob([JSON.stringify({ session_id: this.sessionId })], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } catch {}
  };
}

export const auditTracker = new AuditTracker();

export function trackAudit(action: Action) { auditTracker.track(action); }
