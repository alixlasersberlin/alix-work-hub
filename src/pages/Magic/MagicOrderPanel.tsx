import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, ArrowRight, Check, ChevronRight, Factory, Loader2, Mail, Package, ScanLine, ShieldCheck, Truck, User, Wand2, Warehouse, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import {
  loadDossier, evaluateRequirements, missingFor, readinessScore, nextStepFor, magicWarnings,
  executeMagicStatus, assignSerial, findSerialConflict, serialOf, canUseStatus,
  currentSupplyStage, canUseSupplyStage, setSupplyStage, type MagicDossier, type MagicResult,
} from '@/lib/magic/engine';
import { MAGIC_STATUSES, STATUS_BY_KEY, statusLabel, statusTone, TONE_CLASS, SUPPLY_STAGES, SUPPLY_STAGE_BY_KEY, type SupplyStage } from '@/lib/magic/statuses';


const fmtMoney = (v: any, c = 'EUR') => v == null ? '—' : `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${c}`;
const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('de-DE') : '—';
const fmtDT = (v: any) => v ? new Date(v).toLocaleString('de-DE') : '—';

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-words">{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground mb-1.5">{title}</div>
      {children}
    </div>
  );
}

export default function MagicOrderPanel({ orderId, onClose }: { orderId: string; onClose?: () => void }) {
  const { roles } = useAuth();
  const [d, setD] = useState<MagicDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [serialOpen, setSerialOpen] = useState(false);
  const [serial, setSerial] = useState('');
  const [conflict, setConflict] = useState<any>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [target, setTarget] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MagicResult | null>(null);
  const [stageTarget, setStageTarget] = useState<SupplyStage | null>(null);
  const [mailBusy, setMailBusy] = useState(false);


  const reload = useCallback(async () => {
    setLoading(true);
    try { setD(await loadDossier(orderId)); }
    catch (e: any) { toast.error(e?.message ?? 'Auftrag konnte nicht geladen werden'); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { reload(); }, [reload]);

  const ev = useMemo(() => d ? evaluateRequirements(d) : null, [d]);
  const score = useMemo(() => d ? readinessScore(d) : null, [d]);
  const warnings = useMemo(() => d ? magicWarnings(d) : [], [d]);
  const next = useMemo(() => d ? nextStepFor(d) : null, [d]);
  const currentSerial = d ? serialOf(d) : null;
  const targetDef = target ? STATUS_BY_KEY[target] : null;
  const blockers = d && targetDef ? missingFor(targetDef, d) : [];
  const stage = d ? currentSupplyStage(d) : null;
  const stageDef = stageTarget ? SUPPLY_STAGE_BY_KEY[stageTarget] : null;


  if (loading || !d) {
    return <Card className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></Card>;
  }

  const o = d.order;
  const c = d.customer;
  const po = d.productionOrders[0];
  const dev = d.devices[0];
  const ship = (o.shipping_address || {}) as any;
  const bill = (o.billing_address || {}) as any;
  const addr = (a: any) => [a?.street || a?.address, [a?.postal_code || a?.zip, a?.city].filter(Boolean).join(' '), a?.country].filter(Boolean).join(', ') || '—';

  const doSerial = async () => {
    if (!serial.trim()) return;
    setBusy(true);
    try {
      const cf = await findSerialConflict(serial, o.id);
      if (cf) { setConflict(cf); setBusy(false); return; }
      const r = await assignSerial(d, serial.trim(), reason || undefined);
      setResult(r);
      r.ok ? toast.success('Seriennummer verbindlich zugewiesen') : toast.error('Zuweisung unvollständig');
      setSerialOpen(false); setSerial(''); setConflict(null);
      await reload();
    } finally { setBusy(false); }
  };

  const doStatus = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await executeMagicStatus(d, target, { reason: reason || undefined });
      setResult(r);
      r.ok ? toast.success(`Magic Status ausgeführt: ${statusLabel(target)}`) : toast.error('Magic Status nicht vollständig');
      setStatusOpen(false); setReason('');
      await reload();
    } finally { setBusy(false); }
  };

  const doStage = async () => {
    if (!stageTarget) return;
    setBusy(true);
    try {
      const r = await setSupplyStage(d, stageTarget, { reason: reason || undefined, notifyCustomer });

      setResult(r);
      r.ok
        ? toast.success(`Lieferkette gesetzt: ${SUPPLY_STAGE_BY_KEY[stageTarget].label}`)
        : toast.error('Lieferkette nicht vollständig ausgeführt');
      setStageTarget(null); setReason('');
      await reload();
    } finally { setBusy(false); }
  };


  return (
    <div className="space-y-3">
      {/* Kopf */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-bold">{o.order_number}{o.source_system === 'zoho_eu_2' ? '-AT' : ''}</div>
            <div className="text-sm text-muted-foreground truncate">
              {c?.company_name || c?.contact_name || '—'} · {po?.modellname || dev?.model_name || 'Produkt offen'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={TONE_CLASS[statusTone(o.magic_status)]}>{statusLabel(o.magic_status)}</Badge>
            {onClose && <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 mt-3">
          <Row label="Zahlung" value={o.finance_payment_status || (o.deposit_ok ? 'Anzahlung ok' : 'offen')} />
          <Row label="Lieferstatus" value={po?.status || o.order_status || '—'} />
          <Row label="Verkäufer" value={o.salesperson_name} />
          <Row label="Auftragsdatum" value={fmtDate(o.order_date || o.created_at)} />
          <Row label="Gepl. Liefertermin" value={fmtDate(po?.liefertermin || o.expected_shipment_date)} />
          <Row label="Priorität" value={o.is_vip ? 'VIP' : 'normal'} />
          <Row label="Seriennummer" value={currentSerial || 'noch nicht vergeben'} />
          <Row label="Summe" value={fmtMoney(o.total_amount, o.currency || 'EUR')} />
        </div>
      </Card>

      {/* Score + nächster Schritt */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Auftragsbereitschaft</span>
          <span className="text-lg font-bold">{score?.percent}%</span>
        </div>
        <Progress value={score?.percent ?? 0} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {score?.items.map((i) => (
            <div key={i.key} className={`text-[12px] flex items-center gap-1.5 ${i.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
              {i.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} {i.label}
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Nächster Schritt</div>
            <div className="font-semibold text-sm">{next?.label}</div>
          </div>
          <Button size="sm" onClick={() => {
            if (next?.action === 'serial') { setSerialOpen(true); return; }
            if (next?.statusKey) { setTarget(next.statusKey); setStatusOpen(true); }
          }}>
            JETZT ERLEDIGEN <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Warnungen */}
      {warnings.length > 0 && (
        <Card className="p-3 border-amber-500/30 bg-amber-500/5 space-y-1">
          {warnings.map((w) => (
            <div key={w} className="text-[12.5px] text-amber-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {w}
            </div>
          ))}
        </Card>
      )}

      {/* Lieferkette */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Lieferkette</span>
          <span className="text-[11px] text-muted-foreground">
            Aktuell: {stage ? SUPPLY_STAGE_BY_KEY[stage].label : 'nicht gesetzt'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SUPPLY_STAGES.map((s, idx) => {
            const active = stage === s.key;
            const allowed = canUseSupplyStage(s, roles);
            return (
              <Button
                key={s.key}
                variant={active ? 'default' : 'outline'}
                disabled={!allowed}
                onClick={() => { setStageTarget(s.key); setReason(''); }}
                className="h-auto flex-col gap-1 py-2.5"
              >
                <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                  {idx === 0 ? <Factory className="w-3.5 h-3.5" /> : idx === 1 ? <Truck className="w-3.5 h-3.5" /> : <Warehouse className="w-3.5 h-3.5" />}
                  {s.label}
                </span>
                <span className="text-[10px] font-normal opacity-70">
                  {allowed ? (active ? 'aktiv' : 'setzen & auslösen') : 'keine Berechtigung'}
                </span>
              </Button>
            );
          })}
        </div>
        {stage && SUPPLY_STAGE_BY_KEY[stage].nextStage && (
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div className="text-[12px] text-muted-foreground">
              Nächste Stufe: <b className="text-foreground">{SUPPLY_STAGE_BY_KEY[SUPPLY_STAGE_BY_KEY[stage].nextStage!].label}</b>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setStageTarget(SUPPLY_STAGE_BY_KEY[stage].nextStage!)}>
              WEITER <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </Card>

      {/* Magic Status ändern */}
      <Card className="p-4 space-y-2">
        <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Magic Status ändern</div>
        <div className="flex gap-2">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Status ändern …" /></SelectTrigger>
            <SelectContent className="max-h-80 z-[60]">
              {MAGIC_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key} disabled={!canUseStatus(s, roles)}>
                  {s.label}{!canUseStatus(s, roles) ? ' · keine Berechtigung' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!target} onClick={() => setStatusOpen(true)}>
            <Wand2 className="w-4 h-4 mr-1" /> PRÜFEN
          </Button>
        </div>
      </Card>


      {/* Schnellaktionen */}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => setSerialOpen(true)}><ScanLine className="w-3.5 h-3.5 mr-1" /> SERIENNUMMER VERGEBEN</Button>
        <Button size="sm" variant="outline" asChild><Link to={`/auftraege/${o.id}`}><Package className="w-3.5 h-3.5 mr-1" /> AUFTRAG ÖFFNEN</Link></Button>
        {c && <Button size="sm" variant="outline" asChild><Link to={`/kunden/${c.id}`}><User className="w-3.5 h-3.5 mr-1" /> KUNDE ÖFFNEN</Link></Button>}
        <Button size="sm" variant="outline" asChild><Link to="/lager"><Truck className="w-3.5 h-3.5 mr-1" /> GERÄTEAKTE</Link></Button>
        <Button size="sm" variant="outline" asChild><Link to="/tickets"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> TICKET</Link></Button>
      </div>

      {/* Detailbereiche */}
      <div className="grid md:grid-cols-2 gap-3">
        <Section title="Kundeninformationen">
          <Row label="Firma" value={c?.company_name} />
          <Row label="Ansprechpartner" value={c?.contact_name} />
          <Row label="Kundennummer" value={c?.external_customer_id} />
          <Row label="Telefon" value={c?.phone} />
          <Row label="E-Mail" value={c?.email} />
          <Row label="Rechnungsadresse" value={addr(bill)} />
          <Row label="Lieferadresse" value={addr(ship)} />
        </Section>

        <Section title="Auftragsdaten">
          <Row label="Auftragsnummer" value={o.order_number} />
          <Row label="Interne Nummer" value={o.internal_number} />
          <Row label="Vorgangsnummer" value={o.case_number} />
          <Row label="Brutto" value={fmtMoney(o.total_amount, o.currency || 'EUR')} />
          <Row label="Anzahlung" value={fmtMoney(o.deposit_amount, o.currency || 'EUR')} />
          <Row label="Offener Betrag" value={fmtMoney(o.finance_open_amount, o.currency || 'EUR')} />
          <Row label="MwSt.-Anzeige" value={o.vat_display_mode} />
          <Row label="Finanzierung" value={o.is_mietkauf ? 'Mietkauf' : '—'} />
        </Section>

        <Section title="Lieferantenbestellung">
          {po ? (
            <>
              <Row label="Bestellnummer" value={po.production_order_number ? `${po.production_order_number}-${po.order_number}` : po.order_number} />
              <Row label="Bestellstatus" value={po.status} />
              <Row label="Freigabe" value={po.approval_status} />
              <Row label="Bestelldatum" value={fmtDate(po.created_at)} />
              <Row label="Liefertermin" value={fmtDate(po.liefertermin)} />
              <Row label="Modell / Farbe" value={[po.modellname, po.farbe].filter(Boolean).join(' · ')} />
              <Row label="Seriennummer" value={po.seriennummer} />
              <Row label="Notizen" value={po.anmerkungen} />
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={mailBusy}
                  onClick={async () => {
                    setMailBusy(true);
                    try {
                      const { sendProductionStartedEmail } = await import('@/lib/send-production-started-email');
                      const r = await sendProductionStartedEmail(po.id, 'manuell');
                      r.ok ? toast.success(`Info-Mail Kunde: ${r.message}`) : toast.error(`Nicht versendet: ${r.message}`);
                    } finally { setMailBusy(false); }
                  }}
                >
                  {mailBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Info-Mail Kunde
                </Button>
              </div>
            </>

          ) : <div className="text-[12.5px] text-muted-foreground">Keine Lieferantenbestellung vorhanden.</div>}
        </Section>

        <Section title="Gerät">
          {dev ? (
            <>
              <Row label="Gerätemodell" value={dev.model_name} />
              <Row label="Seriennummer" value={dev.serial_number} />
              <Row label="Gerätestatus" value={dev.device_status} />
              <Row label="Inbetriebnahme" value={fmtDate(dev.commissioning_date)} />
              <Row label="Letzter Service" value={fmtDate(dev.last_service_date)} />
              <Row label="Nächster Service" value={fmtDate(dev.next_service_date)} />
            </>
          ) : <div className="text-[12.5px] text-muted-foreground">Noch keine Geräteakte – über „Seriennummer vergeben“ wird sie automatisch erzeugt.</div>}
        </Section>

        {d.invoices.length > 0 && (
          <Section title="Rechnungen">
            {d.invoices.map((i) => (
              <Row key={i.id} label={`${i.invoice_number}${i.is_deposit ? ' (AZ)' : ''}`} value={`${i.status} · offen ${fmtMoney(i.balance, i.currency || 'EUR')}`} />
            ))}
          </Section>
        )}

        {d.tickets.length > 0 && (
          <Section title="Tickets">
            {d.tickets.map((t) => <Row key={t.id} label={t.ticket_number || t.id.slice(0, 8)} value={`${t.subject ?? ''} · ${t.status ?? ''}`} />)}
          </Section>
        )}
      </div>

      {/* Timeline */}
      <Section title="Magic Status Timeline">
        {d.log.length === 0 && <div className="text-[12.5px] text-muted-foreground">Noch keine Änderungen protokolliert.</div>}
        <div className="space-y-2">
          {d.log.map((l) => (
            <div key={l.id} className="border-l-2 border-primary/40 pl-3">
              <div className="text-[11px] text-muted-foreground">{fmtDT(l.created_at)} · {l.user_email ?? 'System'}</div>
              <div className="text-[12.5px] font-medium">
                {l.new_status
                  ? <>Status: {statusLabel(l.old_status)} <ChevronRight className="inline w-3 h-3" /> {statusLabel(l.new_status)}</>
                  : <>Seriennummer {l.new_value} vergeben</>}
              </div>
              {(l.actions_failed?.length ?? 0) > 0 && (
                <div className="text-[11.5px] text-rose-500">✕ {(l.actions_failed as string[]).join(' · ')}</div>
              )}
              {l.change_reason && <div className="text-[11.5px] text-muted-foreground">Grund: {l.change_reason}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Dialog: Seriennummer */}
      <Dialog open={serialOpen} onOpenChange={(v) => { setSerialOpen(v); if (!v) setConflict(null); }}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>Seriennummer vergeben</DialogTitle>
            <DialogDescription>
              {po?.modellname || dev?.model_name || 'Gerät'} · {o.order_number} · {c?.company_name || c?.contact_name || 'Kunde'}
            </DialogDescription>
          </DialogHeader>
          <Input autoFocus value={serial} onChange={(e) => { setSerial(e.target.value); setConflict(null); }}
            placeholder="Seriennummer eingeben oder scannen …" className="h-12 text-base font-mono" />
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Änderungsgrund (optional)" rows={2} />
          {conflict && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[12.5px] text-rose-400">
              <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> WARNUNG · Diese Seriennummer existiert bereits.</div>
              {[...conflict.orders, ...conflict.devices].map((x: string) => <div key={x}>· {x}</div>)}
              <div className="mt-1">Speichern verhindert.</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSerialOpen(false)}>Abbrechen</Button>
            <Button disabled={!serial.trim() || busy || !!conflict} onClick={doSerial}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} SERIENNUMMER VERBINDLICH ZUWEISEN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Magic Status ausführen */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>MAGIC STATUS</DialogTitle>
            <DialogDescription>
              Sie ändern den Auftrag von <b>{statusLabel(o.magic_status)}</b> zu <b>{statusLabel(target)}</b>.
            </DialogDescription>
          </DialogHeader>

          {targetDef && !canUseStatus(targetDef, roles) && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[12.5px] text-rose-400">
              Ihre Rolle darf diesen Status nicht setzen.
            </div>
          )}

          {blockers.length > 0 ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[12.5px] text-rose-400 space-y-1">
              <div className="font-semibold">STATUS NICHT MÖGLICH · Fehlende Voraussetzungen:</div>
              {blockers.map((b) => <div key={b.key}>✕ {b.label}</div>)}
              <div className="flex gap-2 pt-1">
                {blockers.some((b) => b.key === 'serial') &&
                  <Button size="sm" variant="outline" onClick={() => { setStatusOpen(false); setSerialOpen(true); }}>SERIENNUMMER VERGEBEN</Button>}
              </div>
            </div>
          ) : (
            <div className="text-[12.5px] space-y-1">
              <div className="text-muted-foreground">Dadurch werden automatisch folgende Schritte ausgeführt:</div>
              {targetDef?.actions.map((a) => (
                <div key={a.key} className="flex items-center gap-1.5 text-emerald-500">✓ {a.label}</div>
              ))}
            </div>
          )}

          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Änderungsgrund (optional, revisionssicher protokolliert)" rows={2} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Abbrechen</Button>
            <Button disabled={busy || blockers.length > 0 || (targetDef ? !canUseStatus(targetDef, roles) : true)} onClick={doStatus}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} MAGIC STATUS AUSFÜHREN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lieferkette */}
      <Dialog open={!!stageTarget} onOpenChange={(v) => { if (!v) setStageTarget(null); }}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>LIEFERKETTE · {stageDef?.label}</DialogTitle>
            <DialogDescription>
              Auftrag {o.order_number} wird auf die Stufe <b>{stageDef?.label}</b> gesetzt.
            </DialogDescription>
          </DialogHeader>

          <div className="text-[12.5px] space-y-1">
            <div className="text-muted-foreground">Folgende Schritte werden automatisch ausgelöst:</div>
            {stageDef?.steps.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-emerald-500">✓ {s}</div>
            ))}
            {!currentSerial && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-500 mt-2">
                Keine Seriennummer vorhanden – die Geräteakte kann nicht gesetzt werden.
                <Button size="sm" variant="outline" className="ml-2" onClick={() => { setStageTarget(null); setSerialOpen(true); }}>
                  SERIENNUMMER VERGEBEN
                </Button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
            <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} className="accent-primary" />
            Kunden-E-Mail zur Stufe versenden
          </label>

          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Änderungsgrund (optional, revisionssicher protokolliert)" rows={2} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setStageTarget(null)}>Abbrechen</Button>
            <Button disabled={busy} onClick={doStage}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} STUFE SETZEN & AUSLÖSEN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Ergebnis */}
      <Dialog open={!!result} onOpenChange={() => setResult(null)}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle className={result?.ok ? 'text-emerald-500' : 'text-amber-500'}>
              {result?.ok ? '✓ MAGIC STATUS AUSGEFÜHRT' : '⚠ MAGIC STATUS NICHT VOLLSTÄNDIG'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-[12.5px] space-y-1">
            {result?.executed.map((x) => <div key={x} className="text-emerald-500">✓ {x}</div>)}
            {result?.failed.map((x) => <div key={x} className="text-rose-500">✕ {x}</div>)}
            {!result?.ok && <div className="text-muted-foreground pt-1">Status: NICHT FINALISIERT – bitte Fehler beheben und erneut ausführen.</div>}
          </div>
          <DialogFooter>
            <Button onClick={() => setResult(null)}>WEITER</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
