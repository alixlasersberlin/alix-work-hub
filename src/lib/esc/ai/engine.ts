// Alix AI · Engine (Prompt 7)
// Purely deterministic analyzers over the in-memory ESC data.
// - No external calls, no hallucinations: every suggestion cites its evidence.
// - Modular: each analyzer returns AiSuggestion[]. New analyzers can be plugged in.

import type { EscAppointment } from '../types';
import { RM_EMPLOYEES, RM_VEHICLES, RM_ROOMS, RM_DEMO_DEVICES } from '../resources/mock';
import type { AiSuggestion, AiPriority, AiSettings } from './types';

function uid() { return crypto.randomUUID(); }
function iso() { return new Date().toISOString(); }

function priorityFrom(score: number): AiPriority {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'info';
}

// --- Analyzer: Unconfirmed appointments coming up soon --------------------
function analyzeUnconfirmed(apps: EscAppointment[]): AiSuggestion[] {
  const now = Date.now();
  const in48h = now + 48 * 3600 * 1000;
  return apps
    .filter((a) => (a.status === 'bestaetigung_offen' || a.status === 'angefragt') && new Date(a.startAt).getTime() < in48h && new Date(a.startAt).getTime() > now)
    .map((a) => {
      const hoursLeft = Math.round((new Date(a.startAt).getTime() - now) / 3600000);
      return {
        id: uid(),
        kind: 'reminder',
        priority: priorityFrom(hoursLeft < 12 ? 85 : hoursLeft < 24 ? 65 : 45),
        status: 'open',
        title: `Bestätigung ausstehend – ${a.title}`,
        reason: `Der Termin startet in ${hoursLeft}h, ist aber noch nicht bestätigt.`,
        benefit: 'Frühzeitige Bestätigung reduziert No-Show-Risiko und ermöglicht Reaktion auf Absagen.',
        confidence: 0.95,
        evidence: [
          { label: 'Status', value: a.status, source: 'esc_events' },
          { label: 'Startzeit', value: a.startAt, source: 'esc_events' },
          { label: 'Kunde', value: a.customerName ?? '—' },
        ],
        refs: { appointmentId: a.id },
        action: { type: 'send_reminder', payload: { appointmentId: a.id } },
        createdAt: iso(),
      } as AiSuggestion;
    });
}

// --- Analyzer: Employee overload (>N per day) ----------------------------
function analyzeOverload(apps: EscAppointment[]): AiSuggestion[] {
  const byEmpDay = new Map<string, EscAppointment[]>();
  for (const a of apps) {
    const day = a.startAt.slice(0, 10);
    for (const eid of a.employeeIds ?? []) {
      const k = `${eid}|${day}`;
      const arr = byEmpDay.get(k) ?? [];
      arr.push(a); byEmpDay.set(k, arr);
    }
  }
  const out: AiSuggestion[] = [];
  for (const [key, list] of byEmpDay.entries()) {
    const [eid, day] = key.split('|');
    const emp = RM_EMPLOYEES.find((e) => e.id === eid);
    const cap = emp?.maxAppointmentsPerDay ?? 5;
    if (list.length > cap) {
      out.push({
        id: uid(),
        kind: 'capacity',
        priority: priorityFrom(80),
        status: 'open',
        title: `Überlastung: ${emp?.name ?? eid} am ${day}`,
        reason: `${list.length} Termine überschreiten die Tageskapazität von ${cap}.`,
        benefit: 'Umverteilung reduziert Stress und Fehlerquote.',
        confidence: 0.9,
        evidence: [
          { label: 'Termine gesamt', value: list.length, source: 'esc_events' },
          { label: 'Tageskapazität', value: cap, source: 'rm_employees' },
        ],
        refs: { employeeId: eid },
        action: { type: 'reassign_employee', payload: { day, employeeId: eid } },
        createdAt: iso(),
      });
    }
  }
  return out;
}

// --- Analyzer: Time-overlap conflicts per employee -----------------------
function analyzeConflicts(apps: EscAppointment[]): AiSuggestion[] {
  const out: AiSuggestion[] = [];
  const byEmp = new Map<string, EscAppointment[]>();
  for (const a of apps) for (const e of a.employeeIds ?? []) {
    const arr = byEmp.get(e) ?? []; arr.push(a); byEmp.set(e, arr);
  }
  for (const [eid, list] of byEmp.entries()) {
    const sorted = [...list].sort((x, y) => x.startAt.localeCompare(y.startAt));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], cur = sorted[i];
      if (cur.startAt < prev.endAt) {
        out.push({
          id: uid(),
          kind: 'schedule',
          priority: priorityFrom(95),
          status: 'open',
          title: `Terminkonflikt: ${prev.title} ⇄ ${cur.title}`,
          reason: `Mitarbeiter ${RM_EMPLOYEES.find((e)=>e.id===eid)?.name ?? eid} ist doppelt gebucht (${prev.endAt} vs ${cur.startAt}).`,
          benefit: 'Auflösen des Konflikts vermeidet Terminausfall.',
          confidence: 1,
          evidence: [
            { label: 'Termin A', value: prev.title },
            { label: 'Termin B', value: cur.title },
          ],
          refs: { employeeId: eid, appointmentId: cur.id },
          action: { type: 'move_time', payload: { appointmentId: cur.id } },
          createdAt: iso(),
        });
      }
    }
  }
  return out;
}

// --- Analyzer: Idle capacity (employees with 0 appointments today) --------
function analyzeIdle(apps: EscAppointment[]): AiSuggestion[] {
  const today = new Date().toISOString().slice(0, 10);
  const busy = new Set<string>();
  apps.filter((a) => a.startAt.slice(0, 10) === today).forEach((a) => a.employeeIds.forEach((e) => busy.add(e)));
  return RM_EMPLOYEES.filter((e) => e.active && !busy.has(e.id)).slice(0, 3).map((e) => ({
    id: uid(),
    kind: 'capacity',
    priority: 'info' as AiPriority,
    status: 'open',
    title: `Freie Kapazität heute: ${e.name}`,
    reason: `Keine Termine für ${e.name} eingeplant – Standort ${e.locationId}.`,
    benefit: 'Kapazität kann für offene Buchungen oder Follow-ups genutzt werden.',
    confidence: 0.8,
    evidence: [
      { label: 'Qualifikationen', value: e.qualifications.join(', ') },
      { label: 'Standort', value: e.locationId },
    ],
    refs: { employeeId: e.id },
    action: { type: 'noop' },
    createdAt: iso(),
  }));
}

// --- Analyzer: No-show risk (heuristic, transparent) ---------------------
function analyzeNoShow(apps: EscAppointment[], settings: AiSettings): AiSuggestion[] {
  const out: AiSuggestion[] = [];
  for (const a of apps) {
    if (a.status === 'abgeschlossen' || a.status === 'storniert') continue;
    if (new Date(a.startAt).getTime() < Date.now()) continue;
    let score = 0;
    const evidence: AiSuggestion['evidence'] = [];
    if (a.status !== 'bestaetigt') { score += 40; evidence.push({ label: 'Nicht bestätigt', value: a.status }); }
    if (!a.customerEmail && !a.customerPhone) { score += 20; evidence.push({ label: 'Keine Kontaktdaten' }); }
    const daysAhead = Math.floor((new Date(a.startAt).getTime() - Date.now()) / 86400000);
    if (daysAhead === 0) { score += 20; evidence.push({ label: 'Kurzfristig (heute)' }); }
    if (score >= settings.noShowWarnAt) {
      out.push({
        id: uid(),
        kind: 'no_show',
        priority: priorityFrom(score),
        status: 'open',
        title: `No-Show-Risiko: ${a.title}`,
        reason: `Heuristischer Risikowert ${score} – nur als Hinweis, keine automatische Ablehnung.`,
        benefit: 'Aktive Bestätigung / Reminder reduziert Ausfallrisiko.',
        confidence: 0.6,
        evidence,
        refs: { appointmentId: a.id },
        action: { type: 'send_reminder', payload: { appointmentId: a.id } },
        createdAt: iso(),
      });
    }
  }
  return out;
}

// --- Analyzer: Route/tour optimization (very small heuristic) -------------
function analyzeRoutes(apps: EscAppointment[]): AiSuggestion[] {
  const today = new Date().toISOString().slice(0, 10);
  const byEmp = new Map<string, EscAppointment[]>();
  for (const a of apps.filter((x) => x.startAt.slice(0, 10) === today && x.address)) {
    for (const e of a.employeeIds ?? []) {
      const arr = byEmp.get(e) ?? []; arr.push(a); byEmp.set(e, arr);
    }
  }
  const out: AiSuggestion[] = [];
  for (const [eid, list] of byEmp.entries()) {
    if (list.length < 2) continue;
    // If the address city changes back and forth, suggest reordering by city grouping.
    const cities = list.map((a) => (a.address || '').split(',').pop()?.trim() || '');
    const unique = new Set(cities);
    if (unique.size < cities.length) {
      out.push({
        id: uid(),
        kind: 'route',
        priority: priorityFrom(50),
        status: 'open',
        title: `Tourenoptimierung möglich (${RM_EMPLOYEES.find((e)=>e.id===eid)?.name ?? eid})`,
        reason: 'Mehrere Termine im selben Ort können gebündelt werden.',
        benefit: 'Erwartete Zeit- und Kilometerersparnis durch Gruppierung nach Stadt.',
        confidence: 0.55,
        evidence: [
          { label: 'Stopps', value: list.length },
          { label: 'Orte', value: Array.from(unique).join(' · ') },
        ],
        refs: { employeeId: eid },
        action: { type: 'reorder_route', payload: { day: today, employeeId: eid } },
        createdAt: iso(),
      });
    }
  }
  return out;
}

// --- Main entry -----------------------------------------------------------
export function runAiAnalysis(apps: EscAppointment[], settings: AiSettings): AiSuggestion[] {
  if (!settings.enabled) return [];
  const all: AiSuggestion[] = [];
  if (settings.kinds.reminder) all.push(...analyzeUnconfirmed(apps));
  if (settings.kinds.capacity) all.push(...analyzeOverload(apps), ...analyzeIdle(apps));
  if (settings.kinds.schedule) all.push(...analyzeConflicts(apps));
  if (settings.kinds.no_show) all.push(...analyzeNoShow(apps, settings));
  if (settings.kinds.route) all.push(...analyzeRoutes(apps));
  const order: Record<AiPriority, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return all
    .filter((s) => order[s.priority] <= order[settings.minPriority])
    .sort((a, b) => order[a.priority] - order[b.priority]);
}

// --- Resource summaries (for Ressourcenoptimierung / Kapazitätsanalyse) --
export interface CapacityRow {
  id: string; name: string; kind: 'employee' | 'vehicle' | 'room' | 'device';
  utilizationPct: number; bookedMinutes: number; capacityMinutes: number;
}
export function computeCapacity(apps: EscAppointment[]): CapacityRow[] {
  const today = new Date().toISOString().slice(0, 10);
  const dayApps = apps.filter((a) => a.startAt.slice(0, 10) === today);
  const minutesOf = (a: EscAppointment) => Math.max(0, (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000);

  const rows: CapacityRow[] = [];
  for (const e of RM_EMPLOYEES) {
    const booked = dayApps.filter((a) => a.employeeIds.includes(e.id)).reduce((s, a) => s + minutesOf(a), 0);
    const cap = e.maxWorkMinutes ?? 480;
    rows.push({ id: e.id, name: e.name, kind: 'employee', bookedMinutes: booked, capacityMinutes: cap, utilizationPct: Math.round((booked / cap) * 100) });
  }
  for (const v of RM_VEHICLES) rows.push({ id: v.id, name: `${v.plate} ${v.brand ?? ''} ${v.model ?? ''}`.trim(), kind: 'vehicle', bookedMinutes: 0, capacityMinutes: 480, utilizationPct: 0 });
  for (const r of RM_ROOMS) rows.push({ id: r.id, name: r.name, kind: 'room', bookedMinutes: 0, capacityMinutes: 480, utilizationPct: 0 });
  for (const d of RM_DEMO_DEVICES) rows.push({ id: d.id, name: d.name, kind: 'device', bookedMinutes: 0, capacityMinutes: 480, utilizationPct: 0 });
  return rows;
}

// --- Forecast (naive moving average from historical count per weekday) ---
export interface ForecastPoint { date: string; expected: number; note: string; }
export function computeForecast(apps: EscAppointment[], horizonDays: number): ForecastPoint[] {
  const byWeekday = new Map<number, number[]>();
  for (const a of apps) {
    const d = new Date(a.startAt);
    const wd = d.getDay();
    const arr = byWeekday.get(wd) ?? []; arr.push(1); byWeekday.set(wd, arr);
  }
  const avgByWd = new Map<number, number>();
  for (const [wd, arr] of byWeekday) avgByWd.set(wd, arr.length / 4); // rough weekly avg
  const out: ForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const wd = d.getDay();
    out.push({
      date: d.toISOString().slice(0, 10),
      expected: Math.round(avgByWd.get(wd) ?? 0),
      note: 'Schätzung auf Basis historischer Termindichte pro Wochentag.',
    });
  }
  return out;
}

// --- Best employee suggestion for a new appointment ---------------------
export interface SlotSuggestion {
  employeeId: string; employeeName: string;
  startAt: string; endAt: string;
  score: number; reason: string;
}
export function suggestBestSlots(opts: {
  durationMinutes: number;
  qualification?: string;
  locationId?: string;
  earliest?: Date;
  existing: EscAppointment[];
}): SlotSuggestion[] {
  const { durationMinutes, qualification, locationId, earliest = new Date(), existing } = opts;
  const candidates = RM_EMPLOYEES.filter((e) => e.active)
    .filter((e) => !qualification || e.qualifications.includes(qualification))
    .filter((e) => !locationId || e.locationId === locationId);
  const results: SlotSuggestion[] = [];
  for (const e of candidates) {
    // find first 30-min-aligned slot in next 5 business days without overlap
    for (let d = 0; d < 7 && results.filter((r) => r.employeeId === e.id).length === 0; d++) {
      const day = new Date(earliest); day.setDate(day.getDate() + d);
      const wd = day.getDay(); if (wd === 0 || wd === 6) continue;
      const shift = e.shifts.find((s) => s.weekday === wd); if (!shift) continue;
      const [fh, fm] = shift.from.split(':').map(Number);
      const [th, tm] = shift.to.split(':').map(Number);
      const start = new Date(day); start.setHours(fh, fm, 0, 0);
      const end = new Date(day); end.setHours(th, tm, 0, 0);
      for (let t = start.getTime(); t + durationMinutes * 60000 <= end.getTime(); t += 30 * 60000) {
        const s = new Date(t); const eT = new Date(t + durationMinutes * 60000);
        const clash = existing.some((a) => a.employeeIds.includes(e.id) && s.toISOString() < a.endAt && eT.toISOString() > a.startAt);
        if (clash) continue;
        results.push({
          employeeId: e.id, employeeName: e.name,
          startAt: s.toISOString(), endAt: eT.toISOString(),
          score: 100 - d * 5,
          reason: `Qualifikation ${qualification ?? 'nicht gefordert'}, Standort ${e.locationId}, freies Zeitfenster im regulären Dienst.`,
        });
        break;
      }
    }
  }
  return results.slice(0, 5);
}
