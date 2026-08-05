import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Input as TextInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, Users, Download, BellRing, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney, CMR_DOC_TYPES } from '@/hooks/useCmrTenant';


type Row = {
  key: string;
  customer_id: string | null;
  name: string;
  email: string | null;
  docs: number;
  gross: number;
  paid: number;
  open: number;
  last: string | null;
};

export default function CmrKunden() {
  const { tenantId, settings, loading, canWrite } = useCmrTenant();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [detailDocs, setDetailDocs] = useState<any[] | null>(null);
  const [dunning, setDunning] = useState<any>(null);
  const [portalBusy, setPortalBusy] = useState<string | null>(null);
  const [portalLink, setPortalLink] = useState<{ name: string; url: string } | null>(null);
  const [dunningSaving, setDunningSaving] = useState(false);

  const cur = settings?.default_currency || 'AED';

  const openDetail = async (r: Row) => {
    setDetail(r);
    setDetailDocs(null);
    let query = supabase
      .from('cmr_documents' as any)
      .select('id,doc_number,doc_type,doc_date,due_date,status,gross_total,paid_total,currency')
      .eq('tenant_id', tenantId)
      .order('doc_date', { ascending: false })
      .limit(200);
    query = r.customer_id ? query.eq('customer_id', r.customer_id) : query.eq('customer_name', r.name);
    const { data } = await query;
    setDetailDocs(((data as any) || []) as any[]);
  };

  /** Individuelle Mahnstufen je Kunde (überschreiben die Mandanten-Einstellung). */
  const openDunning = async (r: Row) => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('cmr_customer_dunning' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', r.customer_id)
      .maybeSingle();
    setDunning({
      row: r,
      id: (data as any)?.id ?? null,
      days_1: (data as any)?.days_1 ?? (settings as any)?.dunning_days_1 ?? 7,
      days_2: (data as any)?.days_2 ?? (settings as any)?.dunning_days_2 ?? 14,
      days_3: (data as any)?.days_3 ?? (settings as any)?.dunning_days_3 ?? 30,
      gap_days: (data as any)?.gap_days ?? (settings as any)?.dunning_gap_days ?? 7,
      fee_1: (data as any)?.fee_1 ?? 0,
      fee_2: (data as any)?.fee_2 ?? 0,
      fee_3: (data as any)?.fee_3 ?? 0,
      interest_pct: (data as any)?.interest_pct ?? 0,
      is_active: (data as any)?.is_active ?? true,
      advance_notice_active: (data as any)?.advance_notice_active,
      advance_notice_days: (data as any)?.advance_notice_days,
      exists: !!(data as any)?.id,
    });
  };

  const saveDunning = async () => {
    if (!tenantId || !dunning) return;
    if (!dunning.row.customer_id) { toast.error('Kunde ohne Kundennummer – keine eigene Mahnstufe möglich'); return; }
    setDunningSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      customer_id: dunning.row.customer_id,
      customer_name: dunning.row.name,
      is_active: !!dunning.is_active,
    };
    ['days_1', 'days_2', 'days_3', 'gap_days', 'fee_1', 'fee_2', 'fee_3', 'interest_pct'].forEach((k) => {
      payload[k] = Number(dunning[k]) || 0;
    });
    payload.advance_notice_active = dunning.advance_notice_active === undefined || dunning.advance_notice_active === null || dunning.advance_notice_active === ''
      ? null : !!dunning.advance_notice_active;
    payload.advance_notice_days = dunning.advance_notice_days === '' || dunning.advance_notice_days === null || dunning.advance_notice_days === undefined
      ? null : Number(dunning.advance_notice_days);
    const { error } = dunning.id
      ? await supabase.from('cmr_customer_dunning' as any).update(payload).eq('id', dunning.id)
      : await supabase.from('cmr_customer_dunning' as any).insert(payload);
    setDunningSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mahnstufen gespeichert');
    setDunning(null);
  };

  const resetDunning = async () => {
    if (!dunning?.id) { setDunning(null); return; }
    const { error } = await supabase.from('cmr_customer_dunning' as any).delete().eq('id', dunning.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Kundenregel entfernt – es gilt wieder die Standardeinstellung');
    setDunning(null);
  };

  /** Erstellt bzw. erneuert einen Portal-Zugangslink für den Kunden. */
  const createPortalLink = async (r: Row) => {
    if (!tenantId) return;
    if (!r.customer_id) { toast.error('Kunde ohne Kundennummer – kein Portalzugang möglich'); return; }
    setPortalBusy(r.customer_id);
    const { data: existing } = await supabase
      .from('cmr_portal_tokens' as any)
      .select('*').eq('tenant_id', tenantId).eq('customer_id', r.customer_id)
      .eq('is_active', true).maybeSingle();

    let token = (existing as any)?.token as string | undefined;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const { error } = await supabase.from('cmr_portal_tokens' as any).insert({
        tenant_id: tenantId,
        customer_id: r.customer_id,
        customer_name: r.name,
        customer_email: (r as any).email ?? null,
        token,
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      });
      if (error) { setPortalBusy(null); toast.error(error.message); return; }
    }
    const url = `${window.location.origin}/cmr-portal/${token}`;
    try { await navigator.clipboard.writeText(url); } catch { /* Clipboard ggf. gesperrt */ }
    setPortalBusy(null);
    setPortalLink({ name: r.name, url });
    toast.success('Portal-Link erstellt und in die Zwischenablage kopiert');
  };

  const exportCsv = () => {
    const sep = ';';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = ['Kunde', 'E-Mail', 'Belege', 'Umsatz', 'Bezahlt', 'Offen', 'Letzter Beleg'].join(sep) + '\n';
    csv += filtered.map((r) => [
      r.name, r.email ?? '', r.docs, r.gross.toFixed(2), r.paid.toFixed(2), r.open.toFixed(2), r.last ?? '',
    ].map(esc).join(sep)).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'CMR_Kunden.csv'; a.click();
    URL.revokeObjectURL(url);
  };


  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setBusy(true);
      const { data } = await supabase
        .from('cmr_documents' as any)
        .select('customer_id,customer_name,customer_email,doc_type,doc_date,gross_total,paid_total,status')
        .eq('tenant_id', tenantId)
        .limit(2000);

      const map = new Map<string, Row>();
      for (const d of ((data as any) || []) as any[]) {
        const key = d.customer_id || d.customer_name || '—';
        const r = map.get(key) ?? {
          key,
          customer_id: d.customer_id ?? null,
          name: d.customer_name || 'Ohne Kunde',
          email: d.customer_email ?? null,
          docs: 0, gross: 0, paid: 0, open: 0, last: null,
        };
        const billable = ['rechnung', 'proforma', 'mahnung', 'zahlungserinnerung'].includes(d.doc_type);
        r.docs += 1;
        if (billable && d.status !== 'storniert') {
          r.gross += Number(d.gross_total || 0);
          r.paid += Number(d.paid_total || 0);
        }
        if (!r.email && d.customer_email) r.email = d.customer_email;
        if (!r.last || (d.doc_date && d.doc_date > r.last)) r.last = d.doc_date;
        map.set(key, r);
      }
      const list = [...map.values()].map((r) => ({ ...r, open: Math.max(0, r.gross - r.paid) }));
      list.sort((a, b) => b.gross - a.gross);
      setRows(list);
      setBusy(false);
    })();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s));
  }, [rows, q]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ gross: a.gross + r.gross, paid: a.paid + r.paid, open: a.open + r.open }),
    { gross: 0, paid: 0, open: 0 },
  ), [filtered]);

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CMR Kunden"
        subtitle="Kundenübersicht auf Basis der CMR-Belege – Umsatz, bezahlt und offene Posten je Kunde."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kunden</div><div className="text-xl font-semibold">{filtered.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Umsatz (brutto)</div><div className="text-xl font-semibold">{cmrMoney(totals.gross, cur)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Bezahlt</div><div className="text-xl font-semibold text-emerald-500">{cmrMoney(totals.paid, cur)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Offen</div><div className="text-xl font-semibold text-amber-500">{cmrMoney(totals.open, cur)}</div></Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Kunde oder E-Mail suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV Export
          </Button>
        </div>


        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 px-2">Kunde</th>
                <th className="text-left py-2 px-2">E-Mail</th>
                <th className="text-right py-2 px-2">Belege</th>
                <th className="text-right py-2 px-2">Umsatz</th>
                <th className="text-right py-2 px-2">Bezahlt</th>
                <th className="text-right py-2 px-2">Offen</th>
                <th className="text-left py-2 px-2">Letzter Beleg</th>
                <th className="text-right py-2 px-2">Mahnstufen</th>
                <th className="text-right py-2 px-2">Portal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key} className="border-b border-border/50 hover:bg-muted/40 cursor-pointer" onClick={() => openDetail(r)}>

                  <td className="py-2 px-2 font-medium">
                    <span className="inline-flex items-center gap-2"><Users className="w-3.5 h-3.5 text-muted-foreground" />{r.name}</span>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{r.email || '—'}</td>
                  <td className="py-2 px-2 text-right">{r.docs}</td>
                  <td className="py-2 px-2 text-right">{cmrMoney(r.gross, cur)}</td>
                  <td className="py-2 px-2 text-right text-emerald-500">{cmrMoney(r.paid, cur)}</td>
                  <td className="py-2 px-2 text-right">
                    {r.open > 0
                      ? <Badge variant="outline" className="border-amber-500/40 text-amber-500">{cmrMoney(r.open, cur)}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{r.last ? new Date(r.last).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="py-2 px-2 text-right">
                    <Button
                      size="sm" variant="ghost" disabled={!canWrite || !r.customer_id}
                      onClick={(e) => { e.stopPropagation(); openDunning(r); }}
                    >
                      <BellRing className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <Button
                      size="sm" variant="ghost" disabled={!canWrite || !r.customer_id || portalBusy === r.customer_id}
                      onClick={(e) => { e.stopPropagation(); createPortalLink(r); }}
                    >
                      {portalBusy === r.customer_id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <LinkIcon className="w-3.5 h-3.5" />}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Keine Kunden gefunden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!portalLink} onOpenChange={(o) => !o && setPortalLink(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Portal-Zugang · {portalLink?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Diesen Link kann der Kunde ohne Login öffnen. Er zeigt ausschließlich Belege,
            offene Posten und Zahlungen dieses Kunden.
          </p>
          <TextInput readOnly value={portalLink?.url ?? ''} onFocus={(e) => e.currentTarget.select()} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(portalLink?.url ?? ''); toast.success('Kopiert'); }}
            >
              Link kopieren
            </Button>
            <Button onClick={() => setPortalLink(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dunning} onOpenChange={(o) => !o && setDunning(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Mahnstufen · {dunning?.row?.name}</DialogTitle></DialogHeader>
          {dunning && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Diese Werte überschreiben für diesen Kunden die allgemeinen CMR-Mahneinstellungen.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'days_1', label: 'Erinnerung ab (Tage)' },
                  { key: 'days_2', label: '1. Mahnung ab (Tage)' },
                  { key: 'days_3', label: '2. Mahnung ab (Tage)' },
                  { key: 'gap_days', label: 'Mindestabstand (Tage)' },
                  { key: 'fee_1', label: 'Gebühr Erinnerung' },
                  { key: 'fee_2', label: 'Gebühr 1. Mahnung' },
                  { key: 'fee_3', label: 'Gebühr 2. Mahnung' },
                  { key: 'interest_pct', label: 'Verzugszinsen p.a. (%)' },
                ].map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <TextInput
                      type="number" step="0.01" value={dunning[f.key] ?? 0}
                      onChange={(e) => setDunning({ ...dunning, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox" className="h-4 w-4" checked={!!dunning.is_active}
                  onChange={(e) => setDunning({ ...dunning, is_active: e.target.checked })}
                />
                Kunde am Mahnlauf teilnehmen lassen
              </label>

              <div className="rounded-md border p-3 space-y-2">
                <div className="text-sm font-medium">Zahlungsavis für diesen Kunden</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vorabinfo</Label>
                    <select
                      className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={dunning.advance_notice_active === null || dunning.advance_notice_active === undefined ? '' : String(dunning.advance_notice_active)}
                      onChange={(e) => setDunning({ ...dunning, advance_notice_active: e.target.value === '' ? null : e.target.value === 'true' })}
                    >
                      <option value="">Standard des Mandanten</option>
                      <option value="true">immer senden</option>
                      <option value="false">nie senden</option>
                    </select>
                  </div>
                  <div>
                    <Label>Vorlauf (Tage)</Label>
                    <TextInput
                      type="number" placeholder="Standard"
                      value={dunning.advance_notice_days ?? ''}
                      onChange={(e) => setDunning({ ...dunning, advance_notice_days: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {dunning?.id && <Button variant="ghost" onClick={resetDunning}>Regel entfernen</Button>}
            <Button variant="outline" onClick={() => setDunning(null)}>Abbrechen</Button>
            <Button onClick={saveDunning} disabled={dunningSaving}>
              {dunningSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setDetailDocs(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.name} · Beleghistorie</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-3 gap-3 mb-2">
              <Card className="p-3"><div className="text-[11px] text-muted-foreground">Umsatz</div><div className="font-semibold">{cmrMoney(detail.gross, cur)}</div></Card>
              <Card className="p-3"><div className="text-[11px] text-muted-foreground">Bezahlt</div><div className="font-semibold text-emerald-500">{cmrMoney(detail.paid, cur)}</div></Card>
              <Card className="p-3"><div className="text-[11px] text-muted-foreground">Offen</div><div className="font-semibold text-amber-500">{cmrMoney(detail.open, cur)}</div></Card>
            </div>
          )}
          <div className="max-h-[55vh] overflow-y-auto">
            {detailDocs === null ? (
              <div className="p-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : detailDocs.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Keine Belege vorhanden.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 px-2">Beleg</th>
                    <th className="text-left py-2 px-2">Typ</th>
                    <th className="text-left py-2 px-2">Datum</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-right py-2 px-2">Brutto</th>
                    <th className="text-right py-2 px-2">Offen</th>
                  </tr>
                </thead>
                <tbody>
                  {detailDocs.map((d) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2 px-2 font-medium">{d.doc_number ?? '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground">{CMR_DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type}</td>
                      <td className="py-2 px-2 text-muted-foreground">{d.doc_date ? new Date(d.doc_date).toLocaleDateString('de-DE') : '—'}</td>
                      <td className="py-2 px-2"><Badge variant="outline" className="text-[10px]">{d.status}</Badge></td>
                      <td className="py-2 px-2 text-right tabular-nums">{cmrMoney(d.gross_total, d.currency || cur)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{cmrMoney(Number(d.gross_total || 0) - Number(d.paid_total || 0), d.currency || cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
