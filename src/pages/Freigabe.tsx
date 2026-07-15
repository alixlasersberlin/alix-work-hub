import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck, ShieldX, Loader2, AlertTriangle, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { listOffers, setOfferApproval, type OfferSnapshot } from '@/lib/offers-store';
import { supabase } from '@/integrations/supabase/client';

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function Freigabe() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin') || hasRole('Admin');
  const [offers, setOffers] = useState<OfferSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<OfferSnapshot | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDecision, setBulkDecision] = useState<'approved' | 'rejected'>('approved');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const all = await listOffers();
    setOffers(all.filter(o => (o.approvalStatus || 'pending') === 'pending'));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('offers-approval-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(o =>
      `${o.offerNumber} ${o.customer?.company_name || ''} ${o.customer?.contact_name || ''} ${o.createdByName || ''}`
        .toLowerCase().includes(q),
    );
  }, [offers, search]);

  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.offerNumber));
  const someSelected = filtered.some((o) => selected.has(o.offerNumber));

  const toggleAll = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSelected) filtered.forEach((o) => n.delete(o.offerNumber));
      else filtered.forEach((o) => n.add(o.offerNumber));
      return n;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const openDialog = (o: OfferSnapshot) => {
    setCurrent(o);
    setNote(o.approvalNote || '');
    setOpen(true);
  };

  const submit = async (decision: 'approved' | 'rejected') => {
    if (!current) return;
    setBusy(true);
    try {
      await setOfferApproval(current.offerNumber, decision, note.trim() || null);
      toast.success(decision === 'approved' ? 'Angebot freigegeben.' : 'Angebot abgelehnt.');
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'Unbekannt'));
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async () => {
    const ids = filtered.filter((o) => selected.has(o.offerNumber)).map((o) => o.offerNumber);
    if (ids.length === 0) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const num of ids) {
      try {
        await setOfferApproval(num, bulkDecision, bulkNote.trim() || null);
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    setBulkOpen(false);
    setBulkNote('');
    setSelected(new Set());
    if (fail === 0) toast.success(`${ok} Angebot(e) ${bulkDecision === 'approved' ? 'freigegeben' : 'abgelehnt'}.`);
    else toast.warning(`${ok} erfolgreich, ${fail} fehlgeschlagen.`);
    await load();
  };

  const openBulk = (decision: 'approved' | 'rejected') => {
    if (selected.size === 0) return toast.info('Bitte zuerst Angebote auswählen.');
    setBulkDecision(decision);
    setBulkNote('');
    setBulkOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={CheckCircle2}
        title="Freigabe – Angebote"
        subtitle="Angebote, die auf Freigabe durch den Super Admin warten."
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="warning" label={`${filtered.length} wartend`} />}
      />

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Angebotsnr., Kunde, Ersteller…"
            className="pl-9 h-9"
          />
        </div>
      </Card>

      {!isSuperAdmin && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-500/5 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
          <div>Nur Super Admins können Angebote freigeben. Diese Liste ist schreibgeschützt.</div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Keine wartenden Angebote.</Card>
      ) : (
        <Card className="overflow-hidden">
          {isSuperAdmin && (
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Alle auswählen"
              />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} ausgewählt` : 'Alle auswählen'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => openBulk('rejected')}
                  disabled={selected.size === 0}
                >
                  <ShieldX className="w-3.5 h-3.5 mr-1.5" /> Auswahl ablehnen
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => openBulk('approved')}
                  disabled={selected.size === 0}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Auswahl freigeben
                </Button>
              </div>
            </div>
          )}
          <div className="divide-y divide-border">
            {filtered.map((o) => (
              <div key={o.offerNumber} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {isSuperAdmin && (
                  <Checkbox
                    checked={selected.has(o.offerNumber)}
                    onCheckedChange={() => toggleOne(o.offerNumber)}
                    aria-label={`${o.offerNumber} auswählen`}
                  />
                )}
                <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/verkauf/angebote/${encodeURIComponent(o.offerNumber)}`} className="font-medium text-sm hover:underline">
                      {o.offerNumber}
                    </Link>
                    <Badge variant="outline" className="text-[10px]">{o.status || 'draft'}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtMoney(o.totals?.gross || 0)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                    {(o.customer?.company_name || o.customer?.contact_name) && (
                      <span className="font-medium text-foreground/90">{o.customer?.company_name || o.customer?.contact_name}</span>
                    )}
                    {o.createdByName && <span>· {o.createdByName}</span>}
                    {o.createdAt && <span>· {format(new Date(o.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}</span>}
                  </div>
                </div>
                {isSuperAdmin && (
                  <Button size="sm" onClick={() => openDialog(o)}>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Prüfen
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Angebot freigeben oder ablehnen</DialogTitle>
            <DialogDescription>
              {current ? `${current.offerNumber} · ${current.customer?.company_name || current.customer?.contact_name || ''} · ${fmtMoney(current.totals?.gross || 0)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Notiz (optional)</label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Hinweise zur Freigabe…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Abbrechen</Button>
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => submit('rejected')} disabled={busy}>
              <ShieldX className="w-4 h-4 mr-1.5" /> Ablehnen
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => submit('approved')} disabled={busy}>
              <ShieldCheck className="w-4 h-4 mr-1.5" /> Freigeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected.size} Angebot(e) {bulkDecision === 'approved' ? 'freigeben' : 'ablehnen'}
            </DialogTitle>
            <DialogDescription>
              Diese Aktion wird auf alle markierten Angebote angewendet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Notiz (optional, für alle)</label>
            <Textarea rows={3} value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Optionale Sammelnotiz…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>Abbrechen</Button>
            <Button
              onClick={runBulk}
              disabled={bulkBusy}
              className={bulkDecision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-destructive hover:bg-destructive/90 text-white'}
            >
              {bulkBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : bulkDecision === 'approved' ? <ShieldCheck className="w-4 h-4 mr-1.5" /> : <ShieldX className="w-4 h-4 mr-1.5" />}
              {bulkDecision === 'approved' ? 'Freigeben' : 'Ablehnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
