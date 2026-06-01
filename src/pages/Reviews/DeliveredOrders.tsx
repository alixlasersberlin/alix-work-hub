import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, RotateCw, CheckCircle2, Loader2, Search, Mail, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { sendReviewInvitation } from '@/lib/review-invitation';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Order = {
  id: string;
  order_number: string;
  order_date: string | null;
  total_amount: number | null;
  customer_id: string;
  customers?: { company_name: string | null; contact_name: string | null; email: string | null } | null;
};

type Review = {
  id?: string;
  order_id: string;
  invitation_sent_at: string | null;
  invitation_status: string | null;
  submitted_at: string | null;
  rating_delivery: number | null;
  closed_at: string | null;
  closed_by: string | null;
  closed_reason: string | null;
};

export default function DeliveredOrders() {
  const { hasRole, user } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [closeTarget, setCloseTarget] = useState<Order | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkAction, setBulkAction] = useState<null | 'send' | 'close'>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  async function load() {
    setLoading(true);
    const { data: ordersData, error } = await (supabase as any)
      .from('orders')
      .select('id, order_number, order_date, total_amount, customer_id, customers(company_name, contact_name, email)')
      .eq('order_status', 'geliefert')
      .order('order_date', { ascending: false })
      .limit(1000);
    if (error) toast.error('Aufträge laden fehlgeschlagen: ' + error.message);
    const list = (ordersData ?? []) as Order[];
    setOrders(list);

    if (list.length) {
      const ids = list.map(o => o.id);
      const { data: revData } = await (supabase as any)
        .from('reviews')
        .select('id, order_id, invitation_sent_at, invitation_status, submitted_at, rating_delivery, closed_at, closed_by, closed_reason')
        .in('order_id', ids);
      const map: Record<string, Review> = {};
      ((revData ?? []) as Review[]).forEach(r => { map[r.order_id] = r; });
      setReviews(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.customers?.company_name || '').toLowerCase().includes(q) ||
      (o.customers?.contact_name || '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  // Pagination: 20 / 50 / 100 / all
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  useEffect(() => { /* reset selection on filter change handled below */ }, [search]);
  const visible = useMemo(
    () => (pageSize === 'all' ? filtered : filtered.slice(0, pageSize)),
    [filtered, pageSize],
  );

  // Only orders that are actionable (not submitted, not closed) can be selected
  // Scoped to the currently visible (paginated) rows so "Alle auswählen" matches what the user sees.
  const selectableIds = useMemo(() => {
    return visible
      .filter(o => {
        const r = reviews[o.id];
        return !r?.submitted_at && !r?.closed_at;
      })
      .map(o => o.id);
  }, [visible, reviews]);

  const selectedIds = useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected]);
  const selectedCount = selectedIds.length;
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected[id]);
  const someSelected = selectedCount > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      selectableIds.forEach(id => { next[id] = true; });
      setSelected(next);
    }
  }
  function toggleOne(id: string) {
    setSelected(s => ({ ...s, [id]: !s[id] }));
  }
  function clearSelection() {
    setSelected({});
  }

  // Filter selected by capability for the chosen action
  const selectedOrders = useMemo(
    () => filtered.filter(o => selected[o.id]),
    [filtered, selected],
  );
  const sendableSelected = useMemo(
    () => selectedOrders.filter(o => !!o.customers?.email),
    [selectedOrders],
  );

  async function sendInvite(orderId: string, hasEmail: boolean) {
    if (!hasEmail) {
      toast.error('Für diesen Auftrag ist keine Kunden-E-Mail hinterlegt.');
      return;
    }
    setBusy(orderId);
    const r = await sendReviewInvitation(orderId, { manual: true });
    setBusy(null);
    if (r.ok) { toast.success('Einladung versendet'); load(); }
    else toast.error('Versand fehlgeschlagen: ' + (r.message || ''));
  }

  async function confirmClose() {
    if (!closeTarget) return;
    const order = closeTarget;
    setBusy(order.id);
    const existing = reviews[order.id];
    let error: any = null;
    if (existing?.id) {
      const res = await (supabase as any)
        .from('reviews')
        .update({
          closed_at: new Date().toISOString(),
          closed_by: user?.id ?? null,
          closed_reason: closeReason.trim() || null,
          status: 'archived',
        })
        .eq('id', existing.id);
      error = res.error;
    } else {
      const token = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? `closed-${crypto.randomUUID()}`
        : `closed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await (supabase as any)
        .from('reviews')
        .insert({
          order_id: order.id,
          customer_id: order.customer_id,
          customer_name: order.customers?.company_name || order.customers?.contact_name || null,
          customer_email: order.customers?.email || null,
          order_number: order.order_number,
          review_token: token,
          closed_at: new Date().toISOString(),
          closed_by: user?.id ?? null,
          closed_reason: closeReason.trim() || null,
          status: 'archived',
        });
      error = res.error;
    }
    setBusy(null);
    if (error) {
      toast.error('Schließen fehlgeschlagen: ' + error.message);
    } else {
      toast.success('Auftrag für Bewertung geschlossen');
      setCloseTarget(null);
      setCloseReason('');
      load();
    }
  }

  async function reopenReview(orderId: string) {
    const existing = reviews[orderId];
    if (!existing?.id) return;
    setBusy(orderId);
    const { error } = await (supabase as any)
      .from('reviews')
      .update({ closed_at: null, closed_by: null, closed_reason: null, status: existing.submitted_at ? 'submitted' : 'open' })
      .eq('id', existing.id);
    setBusy(null);
    if (error) toast.error('Wiederöffnen fehlgeschlagen: ' + error.message);
    else { toast.success('Bewertung wieder geöffnet'); load(); }
  }

  async function runBulkSend() {
    const targets = sendableSelected;
    if (!targets.length) return;
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: targets.length });
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i++) {
      const o = targets[i];
      const r = await sendReviewInvitation(o.id, { manual: true });
      if (r.ok) ok++; else fail++;
      setBulkProgress({ done: i + 1, total: targets.length });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    setBulkAction(null);
    clearSelection();
    if (fail === 0) toast.success(`${ok} Einladungen versendet`);
    else toast.warning(`${ok} versendet, ${fail} fehlgeschlagen`);
    load();
  }

  async function runBulkClose() {
    const targets = selectedOrders;
    if (!targets.length) return;
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: targets.length });
    const reason = bulkReason.trim() || null;
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i++) {
      const order = targets[i];
      const existing = reviews[order.id];
      let error: any = null;
      if (existing?.id) {
        const res = await (supabase as any)
          .from('reviews')
          .update({
            closed_at: new Date().toISOString(),
            closed_by: user?.id ?? null,
            closed_reason: reason,
            status: 'archived',
          })
          .eq('id', existing.id);
        error = res.error;
      } else {
        const token = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? `closed-${crypto.randomUUID()}`
          : `closed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const res = await (supabase as any)
          .from('reviews')
          .insert({
            order_id: order.id,
            customer_id: order.customer_id,
            customer_name: order.customers?.company_name || order.customers?.contact_name || null,
            customer_email: order.customers?.email || null,
            order_number: order.order_number,
            review_token: token,
            closed_at: new Date().toISOString(),
            closed_by: user?.id ?? null,
            closed_reason: reason,
            status: 'archived',
          });
        error = res.error;
      }
      if (error) fail++; else ok++;
      setBulkProgress({ done: i + 1, total: targets.length });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    setBulkAction(null);
    setBulkReason('');
    clearSelection();
    if (fail === 0) toast.success(`${ok} Aufträge geschlossen`);
    else toast.warning(`${ok} geschlossen, ${fail} fehlgeschlagen`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {loading
            ? '…'
            : pageSize === 'all' || filtered.length <= (pageSize as number)
              ? `${filtered.length} ausgelieferte Aufträge`
              : `${visible.length} von ${filtered.length} ausgelieferten Aufträgen`}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-md border bg-card p-0.5">
            {([20, 50, 100, 'all'] as const).map(size => (
              <Button
                key={String(size)}
                size="sm"
                variant={pageSize === size ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => { setPageSize(size); }}
              >
                {size === 'all' ? 'Alle' : size}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Auftrag oder Kunde suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-72"
            />
          </div>
        </div>
      </div>


      {isSuperAdmin && selectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border bg-card px-4 py-2">
          <div className="text-sm">
            <span className="font-medium">{selectedCount}</span> ausgewählt
            {sendableSelected.length !== selectedCount && (
              <span className="text-muted-foreground ml-2">
                ({sendableSelected.length} mit E-Mail · {selectedCount - sendableSelected.length} ohne)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelection}>Abbrechen</Button>
            <Button
              size="sm"
              variant="default"
              disabled={sendableSelected.length === 0}
              onClick={() => setBulkAction('send')}
            >
              <Send className="h-4 w-4" /> Massenversand ({sendableSelected.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setBulkReason(''); setBulkAction('close'); }}
            >
              <Lock className="h-4 w-4" /> Alle schließen ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {isSuperAdmin && (
                <TableHead className="w-8">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    aria-label="Alle auswählen"
                  />
                </TableHead>
              )}
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Lieferdatum</TableHead>
              <TableHead>Einladung</TableHead>
              <TableHead>Bewertung</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-10 text-muted-foreground">
                  Keine ausgelieferten Aufträge.
                </TableCell>
              </TableRow>
            )}
            {visible.map(o => {
              const rev = reviews[o.id];
              const hasEmail = !!o.customers?.email;
              const submitted = !!rev?.submitted_at;
              const sent = !!rev?.invitation_sent_at;
              const closed = !!rev?.closed_at;
              const selectable = !submitted && !closed;
              return (
                <TableRow
                  key={o.id}
                  className={
                    submitted ? 'bg-emerald-500/5'
                    : closed ? 'bg-muted/40 text-muted-foreground'
                    : ''
                  }
                >
                  {isSuperAdmin && (
                    <TableCell>
                      <Checkbox
                        checked={!!selected[o.id]}
                        onCheckedChange={() => toggleOne(o.id)}
                        disabled={!selectable}
                        aria-label={`Auftrag ${o.order_number} auswählen`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link to={`/auftraege/${o.id}`} className="font-mono text-xs hover:underline">
                      {o.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.customers?.company_name || o.customers?.contact_name || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {hasEmail ? (
                      <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {o.customers?.email}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <AlertTriangle className="h-3 w-3" /> keine E-Mail
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}
                  </TableCell>
                  <TableCell>
                    {sent ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        {new Date(rev!.invitation_sent_at!).toLocaleDateString('de-DE')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {submitted ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        abgegeben{rev?.rating_delivery ? ` · ${rev.rating_delivery}★` : ''}
                      </span>
                    ) : closed ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/70"
                        title={rev?.closed_reason || ''}
                      >
                        <Lock className="h-3 w-3" /> geschlossen
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">offen</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      {isSuperAdmin && !submitted && !closed && (
                        <>
                          <Button
                            size="sm"
                            variant={sent ? 'outline' : 'default'}
                            disabled={busy === o.id || !hasEmail}
                            onClick={() => sendInvite(o.id, hasEmail)}
                          >
                            {busy === o.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : sent ? (
                              <><RotateCw className="h-4 w-4" /> Erneut senden</>
                            ) : (
                              <><Send className="h-4 w-4" /> Bewertung senden</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === o.id}
                            onClick={() => { setCloseTarget(o); setCloseReason(''); }}
                            title="Auftrag für Bewertung schließen"
                          >
                            <Lock className="h-4 w-4" /> Schließen
                          </Button>
                        </>
                      )}
                      {isSuperAdmin && closed && !submitted && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === o.id}
                          onClick={() => reopenReview(o.id)}
                          title="Bewertung wieder öffnen"
                        >
                          {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlock className="h-4 w-4" /> Öffnen</>}
                        </Button>
                      )}
                      {submitted && <span className="text-xs text-muted-foreground">erledigt</span>}
                      {!isSuperAdmin && !submitted && !closed && <span className="text-xs text-muted-foreground">—</span>}
                      {!isSuperAdmin && closed && <span className="text-xs text-muted-foreground">geschlossen</span>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!closeTarget} onOpenChange={(open) => { if (!open) { setCloseTarget(null); setCloseReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag für Bewertung schließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Für Auftrag <span className="font-mono">{closeTarget?.order_number}</span> wird keine
              Bewertungseinladung mehr versendet. Du kannst diesen Vorgang später wieder öffnen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Grund (optional)</label>
            <Input
              value={closeReason}
              onChange={e => setCloseReason(e.target.value)}
              placeholder="z. B. Kunde wünscht keine Kontaktaufnahme"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} disabled={busy === closeTarget?.id}>
              Schließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction === 'send'} onOpenChange={(open) => { if (!open && !bulkBusy) setBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Massenversand der Bewertungseinladungen?</AlertDialogTitle>
            <AlertDialogDescription>
              An <span className="font-medium">{sendableSelected.length}</span> Kunden wird eine Bewertungseinladung versendet.
              {selectedCount - sendableSelected.length > 0 && (
                <> {selectedCount - sendableSelected.length} Auswahl(en) ohne E-Mail werden übersprungen.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkProgress && (
            <div className="text-sm text-muted-foreground">
              Verarbeite {bulkProgress.done} / {bulkProgress.total}…
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkSend} disabled={bulkBusy || sendableSelected.length === 0}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Jetzt versenden</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction === 'close'} onOpenChange={(open) => { if (!open && !bulkBusy) { setBulkAction(null); setBulkReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedCount} Aufträge für Bewertung schließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Für die ausgewählten Aufträge werden keine Bewertungseinladungen mehr versendet. Du kannst sie später einzeln wieder öffnen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Grund (optional, gilt für alle)</label>
            <Input
              value={bulkReason}
              onChange={e => setBulkReason(e.target.value)}
              placeholder="z. B. Kunde wünscht keine Kontaktaufnahme"
              disabled={bulkBusy}
            />
          </div>
          {bulkProgress && (
            <div className="text-sm text-muted-foreground">
              Verarbeite {bulkProgress.done} / {bulkProgress.total}…
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkClose} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Alle schließen</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
