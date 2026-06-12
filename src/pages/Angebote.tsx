import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, FilePlus, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'alix_angebote_v1';

type SavedOffer = {
  offerNumber: string;
  offerDate: string;
  validUntil?: string;
  customer?: { company_name?: string; contact_name?: string; email?: string } | null;
  totals?: { net: number; tax: number; gross: number };
  createdAt: string;
  status?: 'draft' | 'order' | 'signed';
  signedAt?: string;
};

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function Angebote() {
  const [offers, setOffers] = useState<SavedOffer[]>([]);

  const reload = () => {
    try {
      const raw = localStorage.getItem(KEY);
      setOffers(raw ? JSON.parse(raw) : []);
    } catch {
      setOffers([]);
    }
  };

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  // Sync signed offers from alix_sign_requests (on mount, focus, visibility, interval)
  useEffect(() => {
    let cancelled = false;
    const syncSigned = async () => {
      const raw = localStorage.getItem(KEY);
      const current: SavedOffer[] = raw ? JSON.parse(raw) : [];
      const numbers = current
        .filter(o => o.status !== 'signed' && o.status !== 'order')
        .map(o => o.offerNumber);
      if (numbers.length === 0) return;
      const { data, error } = await supabase
        .from('alix_sign_requests')
        .select('offer_number, status, signed_at')
        .in('offer_number', numbers)
        .eq('status', 'unterschrieben');
      if (error || !data || cancelled || data.length === 0) return;
      const signedMap = new Map(data.map((r: any) => [r.offer_number, r.signed_at]));
      let changed = false;
      const next = current.map(o => {
        if (signedMap.has(o.offerNumber) && o.status !== 'signed' && o.status !== 'order') {
          changed = true;
          return { ...o, status: 'signed' as const, signedAt: signedMap.get(o.offerNumber) || new Date().toISOString() };
        }
        return o;
      });
      if (changed) {
        localStorage.setItem(KEY, JSON.stringify(next));
        setOffers(next);
      }
    };
    syncSigned();
    const onFocus = () => syncSigned();
    const onVisible = () => { if (document.visibilityState === 'visible') syncSigned(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const iv = window.setInterval(syncSigned, 30000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(iv);
    };
  }, []);


  const remove = (offerNumber: string) => {
    if (!confirm(`Angebot ${offerNumber} löschen?`)) return;
    const next = offers.filter(o => o.offerNumber !== offerNumber);
    localStorage.setItem(KEY, JSON.stringify(next));
    setOffers(next);
    toast.success('Angebot gelöscht.');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Angebote</h1>
            <p className="text-muted-foreground text-sm">Übersicht aller erstellten Angebote.</p>
          </div>
        </div>
        <Button asChild>
          <Link to="/verkauf/angebot/neu"><FilePlus className="h-4 w-4 mr-2" />Neues Angebot</Link>
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Liste ({offers.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {offers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-10 text-center">
              Noch keine Angebote vorhanden.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Angebotsnr.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead className="text-right">Gesamt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map(o => {
                  const isOrder = o.status === 'order';
                  const isSigned = o.status === 'signed';
                  return (
                  <TableRow key={o.offerNumber}>
                    <TableCell className="font-medium">{o.offerNumber}</TableCell>
                    <TableCell>{o.offerDate ? new Date(o.offerDate).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell>{o.customer?.company_name || o.customer?.contact_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{o.customer?.email || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(o.totals?.gross || 0)}</TableCell>
                    <TableCell>
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Unterzeichnet · in Aufträge übernommen
                        </span>
                      ) : (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${isOrder ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                          {isOrder ? 'Als Auftrag übernommen' : 'Entwurf'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isOrder && !isSigned && (
                        <Button variant="ghost" size="icon" asChild title="Bearbeiten">
                          <Link to={`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => remove(o.offerNumber)} title="Löschen">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
