import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck, ShieldX, Loader2, AlertTriangle, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
        <Card className="divide-y divide-border overflow-hidden">
          {filtered.map((o) => (
            <div key={o.offerNumber} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
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
    </div>
  );
}
