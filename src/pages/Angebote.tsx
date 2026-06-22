import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, FilePlus, Trash2, Pencil, CheckCircle2, Link2, Copy, Download, ShieldCheck, ShieldX, Clock } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/infinity/EmptyState';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import {
  listOffers,
  deleteOffer as deleteOfferDb,
  updateOfferStatus,
  setOfferApproval,
  migrateLegacyOffersOnce,
  type OfferSnapshot,
} from '@/lib/offers-store';

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function Angebote() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const [signLinkOpen, setSignLinkOpen] = useState(false);
  const [signLinkLoading, setSignLinkLoading] = useState(false);
  const [signLinkOffer, setSignLinkOffer] = useState<string | null>(null);
  const [signLinkUrl, setSignLinkUrl] = useState<string | null>(null);
  const [signLinkExpires, setSignLinkExpires] = useState<string | null>(null);
  const [signLinkError, setSignLinkError] = useState<string | null>(null);

  const openSignLink = async (offerNumber: string) => {
    setSignLinkOpen(true);
    setSignLinkOffer(offerNumber);
    setSignLinkUrl(null);
    setSignLinkExpires(null);
    setSignLinkError(null);
    setSignLinkLoading(true);
    try {
      const { data, error } = await supabase
        .from('alix_sign_requests')
        .select('token, expires_at, status, created_at')
        .eq('offer_number', offerNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.token) {
        setSignLinkError('Für dieses Angebot wurde noch kein Unterschriftslink erstellt. Öffne das Angebot und sende es zur Unterschrift.');
      } else {
        setSignLinkUrl(`https://alixwork.de/sign/${data.token}`);
        setSignLinkExpires(data.expires_at || null);
      }
    } catch (e: any) {
      setSignLinkError(e?.message || 'Link konnte nicht geladen werden.');
    } finally {
      setSignLinkLoading(false);
    }
  };

  const copySignLink = async () => {
    if (!signLinkUrl) return;
    try {
      await navigator.clipboard.writeText(signLinkUrl);
      toast.success('Link in Zwischenablage kopiert.');
    } catch {
      toast.error('Kopieren fehlgeschlagen.');
    }
  };

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
                  <TableRow
                    key={o.offerNumber}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}`)}
                  >
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
                          {isOrder ? 'Als Auftrag übernommen' : 'Angebot offen'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}&download=1`)}
                        title="PDF herunterladen"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!isOrder && !isSigned && (
                        <Button variant="ghost" size="icon" asChild title="Bearbeiten">
                          <Link to={`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {!isSigned && (
                        <Button variant="ghost" size="icon" onClick={() => openSignLink(o.offerNumber)} title="Unterschriftslink anzeigen">
                          <Link2 className="h-4 w-4" />
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

      <Dialog open={signLinkOpen} onOpenChange={setSignLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Unterschriftslink</DialogTitle>
            <DialogDescription>
              {signLinkOffer ? `Angebot ${signLinkOffer}` : ''}
              {signLinkExpires ? ` · gültig bis ${new Date(signLinkExpires).toLocaleDateString('de-DE')}` : ''}
            </DialogDescription>
          </DialogHeader>
          {signLinkLoading ? (
            <div className="py-4 text-sm text-muted-foreground">Lade Link…</div>
          ) : signLinkError ? (
            <div className="py-2 text-sm text-destructive">{signLinkError}</div>
          ) : signLinkUrl ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={signLinkUrl} onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copySignLink} className="shrink-0"><Copy className="h-4 w-4 mr-2" />Kopieren</Button>
            </div>
          ) : null}
          <DialogFooter>
            {signLinkUrl && (
              <Button variant="outline" asChild>
                <a href={signLinkUrl} target="_blank" rel="noreferrer">Im neuen Tab öffnen</a>
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSignLinkOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
