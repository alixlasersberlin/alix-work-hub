import { supabase } from '@/integrations/supabase/client';
import { MAGIC_STATUSES, STATUS_BY_KEY, type MagicRequirement, type MagicStatusDef, REQUIREMENT_LABEL, magicRolesForUser, SUPPLY_STAGE_BY_KEY, type SupplyStage, type SupplyStageDef } from './statuses';

export interface MagicDossier {
  order: any;
  customer: any | null;
  productionOrders: any[];
  devices: any[];
  invoices: any[];
  tickets: any[];
  log: any[];
}

export async function loadDossier(orderId: string): Promise<MagicDossier> {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (error || !order) throw new Error(error?.message || 'Auftrag nicht gefunden');
  const o = order as any;

  const [cust, prod, dev, log, tick] = await Promise.all([
    o.customer_id ? supabase.from('customers').select('*').eq('id', o.customer_id).maybeSingle() : Promise.resolve({ data: null } as any),
    supabase.from('production_orders').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('lager_devices').select('*').or(`reserved_order_id.eq.${orderId},delivered_order_id.eq.${orderId}`),
    supabase.from('magic_status_log').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100),
    supabase.from('tickets').select('id, ticket_number, subject, status, created_at').eq('order_id', orderId).limit(20),
  ]);

  let invoices: any[] = [];
  if (o.order_number) {
    const { data } = await supabase.from('zoho_invoices')
      .select('id, invoice_number, status, total, balance, currency, invoice_date, due_date, is_deposit')
      .ilike('reference_number', `%${o.order_number}%`).limit(20);
    invoices = data ?? [];
  }

  return {
    order: o,
    customer: (cust as any)?.data ?? null,
    productionOrders: (prod.data ?? []) as any[],
    devices: (dev.data ?? []) as any[],
    invoices,
    tickets: (tick.data ?? []) as any[],
    log: (log.data ?? []) as any[],
  };
}

/* ---------------- Voraussetzungen ---------------- */

export function serialOf(d: MagicDossier): string | null {
  return d.productionOrders.find((p) => p.seriennummer)?.seriennummer
    ?? d.devices.find((x) => x.serial_number)?.serial_number
    ?? null;
}

export function evaluateRequirements(d: MagicDossier): Record<MagicRequirement, boolean> {
  const o = d.order;
  const ship = (o.shipping_address || {}) as any;
  const openAmount = Number(o.finance_open_amount ?? 0);
  return {
    serial: !!serialOf(d),
    tech_check: /geprueft|geprüft|bestanden|versendet|geliefert/i.test(String(d.productionOrders[0]?.status ?? '')) || !!d.devices.some((x) => /pruef|geprüft|ok/i.test(String(x.device_status ?? ''))),
    documentation: d.productionOrders.some((p) => p.pdf_path || p.attachment_pdf_path) || !!o.signature_status,
    shipping_address: !!(ship.address || ship.street || ship.zip || ship.postal_code || o.billing_address),
    payment_release: !!o.deposit_ok || openAmount <= 0 || /paid|bezahlt/i.test(String(o.finance_payment_status ?? '')),
    deposit: !!o.deposit_ok || Number(o.deposit_amount ?? 0) > 0,
    supplier_order: d.productionOrders.length > 0,
    delivery_date: d.productionOrders.some((p) => p.liefertermin) || !!o.expected_shipment_date,
    tracking: d.productionOrders.some((p) => /versendet|sent|transfer/i.test(String(p.status ?? ''))) || !!o.expected_shipment_date,
    handover: d.devices.some((x) => x.delivered_order_id === o.id || /kunde|geliefert/i.test(String(x.device_status ?? ''))),
  };
}

export interface Blocker { key: MagicRequirement; label: string }

export function missingFor(def: MagicStatusDef, d: MagicDossier): Blocker[] {
  const ev = evaluateRequirements(d);
  return def.requires.filter((r) => !ev[r]).map((r) => ({ key: r, label: REQUIREMENT_LABEL[r] }));
}

export function readinessScore(d: MagicDossier) {
  const ev = evaluateRequirements(d);
  const keys: MagicRequirement[] = ['payment_release', 'supplier_order', 'tech_check', 'serial', 'documentation', 'shipping_address'];
  const ok = keys.filter((k) => ev[k]).length;
  return { percent: Math.round((ok / keys.length) * 100), items: keys.map((k) => ({ key: k, label: REQUIREMENT_LABEL[k], ok: ev[k] })) };
}

export function canUseStatus(def: MagicStatusDef, roles: string[]): boolean {
  if (!def.roles || def.roles.length === 0) return true;
  const mine = magicRolesForUser(roles);
  return def.roles.some((r) => mine.includes(r));
}

export function nextStepFor(d: MagicDossier): { label: string; statusKey?: string; action?: 'serial' } {
  const ev = evaluateRequirements(d);
  if (!ev.supplier_order) return { label: 'Lieferantenbestellung anlegen', statusKey: 'bestellung_ausgeloest' };
  if (!ev.deposit) return { label: 'Anzahlung prüfen / buchen', statusKey: 'anzahlung_offen' };
  if (!ev.serial) return { label: 'Seriennummer vergeben', action: 'serial' };
  if (!ev.tech_check) return { label: 'Technische Prüfung durchführen', statusKey: 'technische_pruefung' };
  if (!ev.documentation) return { label: 'Dokumentation vervollständigen', statusKey: 'dokumentation_offen' };
  if (d.order.magic_status !== 'versandbereit' && d.order.magic_status !== 'versendet' && d.order.magic_status !== 'ausgeliefert')
    return { label: 'Auslieferung freigeben', statusKey: 'versandbereit' };
  return { label: 'Auftrag abschließen', statusKey: 'auftrag_abgeschlossen' };
}

export function magicWarnings(d: MagicDossier): string[] {
  const w: string[] = [];
  const ev = evaluateRequirements(d);
  if (!ev.serial) w.push('Seriennummer fehlt.');
  if (!ev.delivery_date) w.push('Kein Liefertermin hinterlegt.');
  const lt = d.productionOrders.find((p) => p.liefertermin)?.liefertermin;
  if (lt && new Date(lt) < new Date() && !ev.handover) w.push('Liefertermin überschritten.');
  if (!ev.payment_release) w.push('Zahlung offen.');
  if (!ev.tech_check) w.push('Technische Prüfung fehlt.');
  if (d.order.magic_status === 'abnahme_offen') w.push('Abnahme offen.');
  return w;
}

/* ---------------- Seriennummer ---------------- */

export async function findSerialConflict(serial: string, orderId: string) {
  const s = serial.trim();
  if (!s) return null;
  const [{ data: po }, { data: dv }] = await Promise.all([
    supabase.from('production_orders').select('id, order_number, order_id, customer_name_snapshot').eq('seriennummer', s).limit(5),
    supabase.from('lager_devices').select('id, serial_number, customer_name, reserved_order_id, delivered_order_id').eq('serial_number', s).limit(5),
  ]);
  const foreignPo = (po ?? []).filter((p: any) => p.order_id !== orderId);
  const foreignDv = (dv ?? []).filter((x: any) => x.reserved_order_id !== orderId && x.delivered_order_id !== orderId);
  if (foreignPo.length === 0 && foreignDv.length === 0) return null;
  return {
    orders: foreignPo.map((p: any) => `${p.order_number}${p.customer_name_snapshot ? ' · ' + p.customer_name_snapshot : ''}`),
    devices: foreignDv.map((x: any) => `${x.serial_number}${x.customer_name ? ' · ' + x.customer_name : ''}`),
  };
}

export interface MagicResult {
  ok: boolean;
  executed: string[];
  failed: string[];
}

export async function assignSerial(d: MagicDossier, serial: string, reason?: string): Promise<MagicResult> {
  const executed: string[] = [];
  const failed: string[] = [];
  const s = serial.trim();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  const po = d.productionOrders[0];
  if (po) {
    const { error } = await supabase.from('production_orders').update({ seriennummer: s }).eq('id', po.id);
    error ? failed.push(`Seriennummer in Bestellung ${po.order_number}: ${error.message}`) : executed.push('Seriennummer in Lieferantenbestellung gespeichert');
  } else {
    failed.push('Keine Lieferantenbestellung vorhanden – Seriennummer konnte dort nicht gespeichert werden');
  }

  const existing = d.devices.find((x) => !x.serial_number || x.serial_number === s);
  const devicePatch = {
    serial_number: s,
    model_name: existing?.model_name ?? po?.modellname ?? null,
    reserved_order_id: d.order.id,
    customer_name: d.customer?.company_name || d.customer?.contact_name || null,
    customer_email: d.customer?.email || null,
  };
  if (existing) {
    const { error } = await supabase.from('lager_devices').update(devicePatch).eq('id', existing.id);
    error ? failed.push(`Geräteakte: ${error.message}`) : executed.push('Geräteakte aktualisiert & mit Auftrag/Kunde verbunden');
  } else {
    const { error } = await supabase.from('lager_devices').insert({ ...devicePatch, entry_date: new Date().toISOString().slice(0, 10) });
    error ? failed.push(`Geräteakte: ${error.message}`) : executed.push('Geräteakte erstellt & mit Auftrag/Kunde verbunden');
  }

  await supabase.from('magic_status_log').insert({
    entity_type: 'order',
    order_id: d.order.id,
    production_order_id: po?.id ?? null,
    serial_number: s,
    field_name: 'seriennummer',
    old_value: po?.seriennummer ?? null,
    new_value: s,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    actions_executed: executed as any,
    actions_failed: failed as any,
    change_reason: reason ?? null,
    source: 'magic_status.serial',
  });

  return { ok: failed.length === 0, executed, failed };
}

/* ---------------- Statuswechsel ---------------- */

async function runAction(key: string, label: string, d: MagicDossier, extra: Record<string, any>): Promise<{ ok: boolean; note: string }> {
  const orderId = d.order.id;
  const device = d.devices[0];
  try {
    switch (key) {
      case 'device_transit':
        if (!device) return { ok: false, note: `${label} – kein Gerät vorhanden` };
        await supabase.from('lager_devices').update({ device_status: 'Transfer', notes: '[Status: Transfer]' }).eq('id', device.id);
        return { ok: true, note: label };
      case 'device_at_customer':
        if (!device) return { ok: false, note: `${label} – kein Gerät vorhanden` };
        await supabase.from('lager_devices').update({ device_status: 'Beim Kunden', delivered_order_id: orderId }).eq('id', device.id);
        return { ok: true, note: label };
      case 'commissioning':
        if (!device) return { ok: false, note: `${label} – kein Gerät vorhanden` };
        await supabase.from('lager_devices').update({ commissioning_date: new Date().toISOString() }).eq('id', device.id);
        return { ok: true, note: label };
      case 'warranty':
      case 'service_file': {
        if (!device) return { ok: false, note: `${label} – kein Gerät vorhanden` };
        const base = device.commissioning_date ? new Date(device.commissioning_date) : new Date();
        const next = new Date(base); next.setFullYear(next.getFullYear() + 1);
        await supabase.from('lager_devices').update({ next_service_date: next.toISOString() }).eq('id', device.id);
        return { ok: true, note: `${label} (Wartung fällig ${next.toLocaleDateString('de-DE')})` };
      }
      case 'production_status': {
        const po = d.productionOrders[0];
        if (!po) return { ok: false, note: `${label} – keine Lieferantenbestellung` };
        await supabase.from('production_orders').update({ status: extra.productionStatus ?? po.status }).eq('id', po.id);
        return { ok: true, note: label };
      }
      case 'delivery_date_save':
        await supabase.from('orders').update({ expected_shipment_date: new Date().toISOString() }).eq('id', orderId);
        return { ok: true, note: label };
      case 'check_serial':
        return serialOf(d) ? { ok: true, note: label } : { ok: false, note: `${label} – keine Seriennummer vorhanden` };
      default:
        // Prozessschritt ohne eigenständige Datenmutation → revisionssicher protokolliert
        return { ok: true, note: `${label} (protokolliert)` };
    }
  } catch (e: any) {
    return { ok: false, note: `${label}: ${e?.message ?? e}` };
  }
}

export async function executeMagicStatus(
  d: MagicDossier,
  toStatus: string,
  opts: { reason?: string; extra?: Record<string, any> } = {},
): Promise<MagicResult> {
  const def = STATUS_BY_KEY[toStatus];
  if (!def) return { ok: false, executed: [], failed: ['Unbekannter Status'] };

  const missing = missingFor(def, d);
  if (missing.length) return { ok: false, executed: [], failed: missing.map((m) => `Voraussetzung fehlt: ${m.label}`) };

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  const from = d.order.magic_status ?? null;

  const { error: upErr } = await supabase.from('orders').update({
    magic_status: toStatus,
    magic_status_at: new Date().toISOString(),
    magic_status_by: user?.id ?? null,
  }).eq('id', d.order.id);
  if (upErr) return { ok: false, executed: [], failed: [`Status konnte nicht gespeichert werden: ${upErr.message}`] };

  const executed: string[] = ['Auftragsstatus aktualisiert'];
  const failed: string[] = [];
  for (const a of def.actions) {
    const r = await runAction(a.key, a.label, d, opts.extra ?? {});
    (r.ok ? executed : failed).push(r.note);
  }

  await supabase.from('magic_status_log').insert({
    entity_type: 'order',
    order_id: d.order.id,
    device_id: d.devices[0]?.id ?? null,
    production_order_id: d.productionOrders[0]?.id ?? null,
    old_status: from,
    new_status: toStatus,
    serial_number: serialOf(d),
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    actions_executed: executed as any,
    actions_failed: failed as any,
    change_reason: opts.reason ?? null,
    workflow_version: 1,
    source: 'magic_status',
  });

  return { ok: failed.length === 0, executed, failed };
}

export function statusOptions() {
  return MAGIC_STATUSES;
}

/* ---------------- Lieferkette: Produktion → Transfer → Lager ---------------- */

/** Ersetzt/setzt den [Status: X]-Marker in den Notizen der Geräteakte. */
function withStatusMarker(notes: string | null | undefined, status: string): string {
  const cleaned = String(notes ?? '').replace(/\[Status:\s*[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
  return `${cleaned} [Status: ${status}]`.trim();
}

export function currentSupplyStage(d: MagicDossier): SupplyStage | null {
  const dev = d.devices[0];
  const hay = `${dev?.device_status ?? ''} ${dev?.notes ?? ''} ${d.productionOrders[0]?.status ?? ''} ${d.order.magic_status ?? ''}`;
  if (/bestand|lager|wareneingang|ware_eingegangen/i.test(hay)) return 'lager';
  if (/transfer|unterwegs|ware_unterwegs/i.test(hay)) return 'transfer';
  if (/produktion/i.test(hay)) return 'produktion';
  return null;
}

export function canUseSupplyStage(stage: SupplyStageDef, roles: string[]): boolean {
  const mine = magicRolesForUser(roles);
  return stage.roles.some((r) => mine.includes(r));
}

/**
 * Setzt eine Lieferketten-Stufe und löst alle Folgeschritte aus:
 * Geräteakte, Lieferantenbestellung, Magic Status, Protokoll.
 */
export async function setSupplyStage(
  d: MagicDossier,
  stageKey: SupplyStage,
  opts: { reason?: string; notifyCustomer?: boolean } = {},
): Promise<MagicResult> {
  const stage = SUPPLY_STAGE_BY_KEY[stageKey];
  if (!stage) return { ok: false, executed: [], failed: ['Unbekannte Lieferkettenstufe'] };


  const executed: string[] = [];
  const failed: string[] = [];
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  const serial = serialOf(d);
  const po = d.productionOrders[0];
  let device = d.devices[0];

  // 1) Geräteakte
  try {
    if (!device && serial) {
      const { data, error } = await supabase.from('lager_devices').insert({
        serial_number: serial,
        model_name: po?.modellname ?? null,
        reserved_order_id: d.order.id,
        customer_name: d.customer?.company_name || d.customer?.contact_name || null,
        customer_email: d.customer?.email || null,
        device_status: stage.deviceStatus,
        notes: `[Status: ${stage.deviceStatus}]`,
        entry_date: new Date().toISOString().slice(0, 10),
      }).select('*').maybeSingle();
      if (error) throw error;
      device = data as any;
      executed.push(`Geräteakte angelegt & auf „${stage.deviceStatus}" gesetzt`);
    } else if (device) {
      const { error } = await supabase.from('lager_devices').update({
        device_status: stage.deviceStatus,
        notes: withStatusMarker(device.notes, stage.deviceStatus),
        reserved_order_id: device.reserved_order_id ?? d.order.id,
      }).eq('id', device.id);
      if (error) throw error;
      executed.push(`Gerät ${device.serial_number ?? ''} auf „${stage.deviceStatus}" gesetzt`.replace('  ', ' '));
    } else {
      failed.push('Keine Geräteakte und keine Seriennummer vorhanden – Gerätestatus nicht gesetzt');
    }
  } catch (e: any) {
    failed.push(`Geräteakte: ${e?.message ?? e}`);
  }

  // 2) Lieferantenbestellung
  if (po) {
    const { error } = await supabase.from('production_orders').update({ status: stage.productionStatus }).eq('id', po.id);
    error
      ? failed.push(`Lieferantenbestellung: ${error.message}`)
      : executed.push(`Lieferantenbestellung auf „${stage.productionStatus}" gesetzt`);
  } else {
    failed.push('Keine Lieferantenbestellung vorhanden – Bestellstatus nicht gesetzt');
  }

  // 3) Magic Status
  const from = d.order.magic_status ?? null;
  const { error: upErr } = await supabase.from('orders').update({
    magic_status: stage.magicStatus,
    magic_status_at: new Date().toISOString(),
    magic_status_by: user?.id ?? null,
  }).eq('id', d.order.id);
  upErr
    ? failed.push(`Magic Status: ${upErr.message}`)
    : executed.push(`Magic Status auf ${STATUS_BY_KEY[stage.magicStatus]?.label ?? stage.magicStatus} gesetzt`);

  // 4) Folgeschritte protokollieren
  for (const s of stage.steps.slice(3)) executed.push(`${s} (protokolliert)`);

  await supabase.from('magic_status_log').insert({
    entity_type: 'order',
    order_id: d.order.id,
    device_id: device?.id ?? null,
    production_order_id: po?.id ?? null,
    old_status: from,
    new_status: stage.magicStatus,
    serial_number: serial,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    actions_executed: executed as any,
    actions_failed: failed as any,
    change_reason: opts.reason ?? null,
    workflow_version: 1,
    source: `magic_status.supply_chain.${stage.key}`,
  });

  return { ok: failed.length === 0, executed, failed };
}

