import { Fragment, useEffect, useMemo, useState } from 'react';
import { Lock, RefreshCw, Unlock, Pencil, Wallet, ChevronDown, ChevronRight, FileDown, Table as TableIcon } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GeraetesperrenTabs } from './GeraetesperrenTabs';
import { useAuth } from '@/hooks/useAuth';
import { DeviceLockEditDialog, DeviceLockBookDialog, type DeviceLock } from '@/components/finance/DeviceLockDialogs';
import { InvoicePdfDialog, type PdfInvoiceRef } from '@/components/finance/InvoicePdfDialog';


const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

type StatusKey = 'entwurf' | 'vorgeschlagen' | 'aktiv' | 'fehler' | 'aufgehoben';

const STATUS_META: Record<StatusKey, { label: string; className: string }> = {
  entwurf: { label: 'Entwurf', className: 'bg-muted text-muted-foreground border-border' },
  vorgeschlagen: { label: 'Vorgeschlagen', className: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  aktiv: { label: 'Aktiv', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  fehler: { label: 'Fehler', className: 'bg-orange-600/15 text-orange-500 border-orange-600/30' },
  aufgehoben: { label: 'Aufgehoben', className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
};

const FILTERS: { key: 'alle' | StatusKey; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'entwurf', label: 'Entwurf' },
  { key: 'vorgeschlagen', label: 'Vorgeschlagen' },
  { key: 'aktiv', label: 'Aktiv' },
  { key: 'fehler', label: 'Fehler' },
  { key: 'aufgehoben', label: 'Aufgehoben' },
];

function StatusBadge({ status }: { status: string | null }) {
  const meta = STATUS_META[(status ?? '') as StatusKey];
  return (
    <Badge variant="outline" className={meta?.className ?? 'bg-muted text-muted-foreground border-border'}>
      {meta?.label ?? (status ?? '—')}
    </Badge>
  );
}

export default function Geraetesperren() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'alle' | StatusKey>('aktiv');
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(['Admin', 'Super Admin']);
  const [editLock, setEditLock] = useState<DeviceLock | null>(null);
  const [bookLock, setBookLock] = useState<DeviceLock | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<PdfInvoiceRef | null>(null);

  async function openPdf(r: any) {
    let q = supabase.from('zoho_invoices').select('zoho_invoice_id,invoice_number,source_system').limit(1);
    q = r.invoice_id ? q.eq('id', r.invoice_id) : q.eq('invoice_number', r.invoice_number);
    const { data } = await q;
    const inv = (data as any[])?.[0];
    if (!inv?.zoho_invoice_id) return toast.error('Keine Zoho-Rechnung gefunden');
    setPdfInvoice({
      zoho_invoice_id: inv.zoho_invoice_id,
      invoice_number: inv.invoice_number,
      source_system: inv.source_system,
    });
  }


  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('device_locks' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function release(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('device_locks' as any)
      .update({ status: 'aufgehoben', released_at: new Date().toISOString(), released_by: u?.user?.id ?? null } as any)
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Sperre aufgehoben');
    load();
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: rows.length };
    for (const r of rows) c[r.status ?? '—'] = (c[r.status ?? '—'] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'alle' && (r.status ?? '') !== status) return false;
      if (!term) return true;
      return `${r.invoice_number ?? ''} ${r.customer_number ?? ''} ${r.customer_name ?? ''} ${r.lock_note ?? ''}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, q, status]);

  // Eine Zeile je Rechnung – weitere Sperren derselben Rechnung zum Aufklappen
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; items: any[]; total: number }>();
    for (const r of filtered) {
      const key = String(r.invoice_number ?? r.invoice_id ?? r.id);
      let g = map.get(key);
      if (!g) {
        g = { key, items: [], total: 0 };
        map.set(key, g);
      }
      g.items.push(r);
      g.total += Number(r.amount) || 0;
    }
    return Array.from(map.values());
  }, [filtered]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (k: string) => setOpenGroups((s) => ({ ...s, [k]: !s[k] }));


  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={Lock} title="Gerätesperren" subtitle="Übersicht und Verwaltung gesperrter Geräte" noBreadcrumbs />
      <GeraetesperrenTabs />

      <Card className="border-red-500/30">
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              Gerätesperren <Badge variant="destructive">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechnung / Kd.-Nr. / Kunde suchen…" className="w-64" />
              <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={status === f.key ? 'default' : 'outline'}
                onClick={() => setStatus(f.key)}
              >
                {f.label}
                <span className="ml-1.5 opacity-70">{counts[f.key] ?? 0}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Lädt…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">Keine Gerätesperren in dieser Auswahl.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Status</th>
                  <th className="p-2">Rechnung</th>
                  <th className="p-2">Kd.-Nr.</th>
                  <th className="p-2">Kunde</th>
                  <th className="p-2 text-right">Betrag</th>
                  <th className="p-2">Rückl.-Datum</th>
                  <th className="p-2">Sperrvermerk</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const multi = g.items.length > 1;
                  const open = !!openGroups[g.key];
                  const head = g.items[0];
                  const actions = (r: any) => (
                    <div className="flex items-center justify-end gap-2">
                      {canManage && (
                        <>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditLock(r as DeviceLock); }}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Bearbeiten
                          </Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setBookLock(r as DeviceLock); }}>
                            <Wallet className="w-3.5 h-3.5 mr-1" /> Buchen
                          </Button>
                        </>
                      )}
                      {r.status === 'aktiv' && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); release(r.id); }}>
                          <Unlock className="w-3.5 h-3.5 mr-1" /> Aufheben
                        </Button>
                      )}
                    </div>
                  );

                  return (
                    <Fragment key={g.key}>
                      {/* Eine Zeile je Rechnung */}
                      <tr
                        className={`border-t border-border hover:bg-red-500/5 ${multi ? 'cursor-pointer' : ''}`}
                        onClick={multi ? () => toggleGroup(g.key) : undefined}
                      >
                        <td className="p-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {multi ? (open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />) : <span className="w-4" />}
                            <StatusBadge status={head.status} />
                          </span>
                        </td>
                        <td className="p-2 font-medium whitespace-nowrap">
                          {head.invoice_number ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openPdf(head); }}
                              className="text-red-500 underline underline-offset-2 hover:text-red-400"
                            >
                              {head.invoice_number}
                            </button>
                          ) : '—'}
                          {multi && <Badge variant="destructive" className="ml-2">{g.items.length}</Badge>}
                        </td>
                        <td className="p-2 font-mono text-xs whitespace-nowrap">{head.customer_number ?? head.customer_id ?? '—'}</td>
                        <td className="p-2">{head.customer_name ?? '—'}</td>
                        <td className="p-2 text-right whitespace-nowrap font-semibold">{fmt(multi ? g.total : head.amount)}</td>
                        <td className="p-2 whitespace-nowrap">
                          {multi
                            ? (g.items.map((i) => i.return_date).filter(Boolean).sort().slice(-1)[0] ?? '—')
                            : (head.return_date ?? '—')}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-[420px] truncate">
                          {multi ? 'Weitere Sperren – zum Aufklappen klicken' : head.lock_note}
                        </td>
                        <td className="p-2 text-right">{actions(head)}</td>
                      </tr>

                      {/* Aufgeklappte Detailzeilen */}
                      {multi && open && g.items.map((r) => (
                        <tr key={r.id} className="border-t border-border bg-muted/20 hover:bg-red-500/5">
                          <td className="p-2 whitespace-nowrap pl-10"><StatusBadge status={r.status} /></td>
                          <td className="p-2 font-medium whitespace-nowrap">
                            {r.invoice_number ? (
                              <button
                                type="button"
                                onClick={() => openPdf(r)}
                                className="text-red-500 underline underline-offset-2 hover:text-red-400"
                              >
                                {r.invoice_number}
                              </button>
                            ) : '—'}
                          </td>
                          <td className="p-2 font-mono text-xs whitespace-nowrap">{r.customer_number ?? r.customer_id ?? '—'}</td>
                          <td className="p-2">{r.customer_name ?? '—'}</td>
                          <td className="p-2 text-right whitespace-nowrap">{fmt(r.amount)}</td>
                          <td className="p-2 whitespace-nowrap">{r.return_date ?? '—'}</td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[420px]">{r.lock_note}</td>
                          <td className="p-2 text-right">{actions(r)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>

            </table>
          )}
        </CardContent>
      </Card>

      <DeviceLockEditDialog
        lock={editLock}
        open={!!editLock}
        onOpenChange={(v) => !v && setEditLock(null)}
        onSaved={load}
      />
      <DeviceLockBookDialog
        lock={bookLock}
        open={!!bookLock}
        onOpenChange={(v) => !v && setBookLock(null)}
        onBooked={load}
      />
      <InvoicePdfDialog
        invoice={pdfInvoice}
        open={!!pdfInvoice}
        onOpenChange={(v) => !v && setPdfInvoice(null)}
      />
    </div>
  );
}
