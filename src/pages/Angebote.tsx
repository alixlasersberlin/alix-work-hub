import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, FilePlus, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/infinity/EmptyState';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import {
  listOffers,
  deleteOffer as deleteOfferDb,
  updateOfferStatus,
  migrateLegacyOffersOnce,
  type OfferSnapshot,
} from '@/lib/offers-store';

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function Angebote() {
  const [offers, setOffers] = useState<OfferSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const list = await listOffers();
    setOffers(list);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const migrated = await migrateLegacyOffersOnce();
      if (migrated > 0) toast.success(`${migrated} lokal gespeicherte Angebote in die zentrale Datenbank übernommen.`);
      await reload();
    })();
  }, []);

  // Sync signed offers from alix_sign_requests
  useEffect(() => {
    let cancelled = false;
    const syncSigned = async () => {
      const open = offers.filter(o => o.status !== 'signed' && o.status !== 'order').map(o => o.offerNumber);
      if (open.length === 0) return;
      const { data, error } = await supabase
        .from('alix_sign_requests')
        .select('offer_number, status, signed_at')
        .in('offer_number', open)
        .eq('status', 'unterschrieben');
      if (error || !data || cancelled || data.length === 0) return;
      const signedMap = new Map(data.map((r: any) => [r.offer_number, r.signed_at]));
      await Promise.all(
        Array.from(signedMap.keys()).map((num) =>
          supabase.functions.invoke('convert-signed-offer-to-order', { body: { offer_number: num } })
            .catch((e) => console.warn('convert offer failed', num, e))
        )
      );
      await Promise.all(
        Array.from(signedMap.entries()).map(([num, at]) =>
          updateOfferStatus(num, 'signed', at || new Date().toISOString()).catch(() => null)
        )
      );
      await reload();
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
  }, [offers.length]);

  const remove = async (offerNumber: string) => {
    if (!confirm(`Angebot ${offerNumber} löschen?`)) return;
    try {
      await deleteOfferDb(offerNumber);
      toast.success('Angebot gelöscht.');
      reload();
    } catch (e: any) {
      toast.error('Löschen fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={FileText}
        title="Angebote"
        subtitle="Übersicht aller von allen Mitarbeitern erstellten Angebote."
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="done" label={`${offers.length}`} />}
        actions={
          <Button asChild className="gold-gradient text-black hover:opacity-90">
            <Link to="/verkauf/angebot/neu"><FilePlus className="h-4 w-4 mr-2" />Neues Angebot</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader><CardTitle>Liste ({offers.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Lade Angebote…</div>
          ) : offers.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={FileText} title="Noch keine Angebote" description="Sobald Angebote erstellt wurden, erscheinen sie hier." compact />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Angebotsnr.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Ersteller</TableHead>
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
                    <TableCell className="text-muted-foreground">{o.createdByName || '—'}</TableCell>
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
