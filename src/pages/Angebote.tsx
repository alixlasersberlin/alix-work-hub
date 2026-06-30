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
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [offers, setOffers] = useState<OfferSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const [signLinkOpen, setSignLinkOpen] = useState(false);
  const [signLinkLoading, setSignLinkLoading] = useState(false);
  const [signLinkOffer, setSignLinkOffer] = useState<string | null>(null);
  const [signLinkUrl, setSignLinkUrl] = useState<string | null>(null);
  const [signLinkExpires, setSignLinkExpires] = useState<string | null>(null);
  const [signLinkError, setSignLinkError] = useState<string | null>(null);

  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalOffer, setApprovalOffer] = useState<OfferSnapshot | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);

  const pendingOffers = offers.filter(o => (o.approvalStatus || 'pending') === 'pending');
  const pendingCount = pendingOffers.length;

  const openApproval = (o: OfferSnapshot) => {
    // Reset any stale pointer-events left over by a previously closed Radix overlay
    try { document.body.style.pointerEvents = ''; } catch { /* noop */ }
    setApprovalOffer(o);
    setApprovalNote(o.approvalNote || '');
    // Defer to next frame so state batches before the dialog mounts its portal
    requestAnimationFrame(() => setApprovalOpen(true));
  };

  const submitApproval = async (decision: 'approved' | 'rejected') => {
    if (!approvalOffer) return;
    setApprovalBusy(true);
    try {
      await setOfferApproval(approvalOffer.offerNumber, decision, approvalNote.trim() || null);
      toast.success(decision === 'approved' ? 'Angebot freigegeben.' : 'Angebot abgelehnt.');
      setApprovalOpen(false);
      await reload();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'Unbekannt'));
    } finally {
      setApprovalBusy(false);
    }
  };

  const openSignLink = async (offerNumber: string) => {
    // Pre-open a tab synchronously so popup blockers allow it later.
    const popup = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
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
        const offer = offers.find((o) => o.offerNumber === offerNumber);
        const customerEmail = offer?.customer?.email;
        if (!offer || !customerEmail) {
          setSignLinkError('Für dieses Angebot wurde noch kein Unterschriftslink erstellt und es fehlt eine Kunden-E-Mail-Adresse.');
          return;
        }

        const { data: created, error: createError } = await supabase.functions.invoke('alix-sign-create', {
          body: {
            offer_number: offerNumber,
            offer_payload: offer,
            customer_id: offer.customer?.id || null,
            customer_email: customerEmail,
            customer_name: offer.customer?.contact_name || offer.customer?.company_name || null,
            base_url: 'https://alixwork.de',
            expires_days: 14,
          },
        });
        if (createError || (created as any)?.error) {
          throw new Error(createError?.message || (created as any)?.error || 'Link konnte nicht erstellt werden.');
        }

        const createdUrl = (created as any)?.sign_url || ((created as any)?.token ? `https://alixwork.de/sign/${(created as any).token}` : null);
        if (!createdUrl) throw new Error('Link konnte nicht erstellt werden.');
        setSignLinkUrl(createdUrl);
        setSignLinkExpires((created as any)?.expires_at || null);
        toast.success('Neuer Unterschriftslink wurde erstellt.');
        if (popup) popup.location.href = createdUrl;
      } else {
        const url = `https://alixwork.de/sign/${data.token}`;
        setSignLinkUrl(url);
        setSignLinkExpires(data.expires_at || null);
        if (popup) popup.location.href = url;
      }
    } catch (e: any) {
      if (popup) popup.close();
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
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Button
                variant="outline"
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                onClick={() => {
                  if (pendingCount === 0) {
                    toast.info('Keine offenen Freigaben.');
                    return;
                  }
                  setPendingPanelOpen(v => !v);
                }}
                title="Offene Freigaben (nur Super Admin)"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Freigaben{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Button>
            )}
            <Button asChild className="gold-gradient text-black hover:opacity-90">
              <Link to="/verkauf/angebot/neu"><FilePlus className="h-4 w-4 mr-2" />Neues Angebot</Link>
            </Button>
          </div>
        }
      />

      {isSuperAdmin && pendingPanelOpen && pendingCount > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" /> Offene Freigaben ({pendingCount})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setPendingPanelOpen(false)}>Schließen</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Angebotsnr.</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead className="text-right">Summe</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOffers.map(o => (
                  <TableRow key={o.offerNumber}>
                    <TableCell className="font-mono text-xs">{o.offerNumber}</TableCell>
                    <TableCell>{o.customer?.company_name || o.customer?.contact_name || '—'}</TableCell>
                    <TableCell className="text-right">{fmtMoney(o.totals?.gross || 0)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                        onClick={() => openApproval(o)}
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" /> Prüfen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}



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
                  <TableHead>Freigabe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map(o => {
                  const isOrder = o.status === 'order';
                  const isSigned = o.status === 'signed';
                  const approval = (o.approvalStatus || 'pending') as 'pending' | 'approved' | 'rejected';
                  const isApproved = approval === 'approved';
                  const canEditOrSign = isApproved || isSuperAdmin;
                  return (
                  <TableRow
                    key={o.offerNumber}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (!canEditOrSign) {
                        toast.info('Angebot wartet auf Freigabe durch den Super Admin.');
                        return;
                      }
                      navigate(`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}`);
                    }}
                  >
                    <TableCell className="font-medium">{o.offerNumber}</TableCell>
                    <TableCell>{o.offerDate ? new Date(o.offerDate).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell>{o.customer?.company_name || o.customer?.contact_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{o.customer?.email || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{o.createdByName || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(o.totals?.gross || 0)}</TableCell>
                    <TableCell>
                      {approval === 'approved' ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <ShieldCheck className="h-3 w-3" /> Freigegeben
                        </span>
                      ) : approval === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                          <ShieldX className="h-3 w-3" /> Abgelehnt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3" /> Wartet auf Freigabe
                        </span>
                      )}
                    </TableCell>
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
                      {isSuperAdmin && approval !== 'approved' && (
                        <Button variant="ghost" size="icon" onClick={() => openApproval(o)} title="Freigeben / Ablehnen">
                          <ShieldCheck className="h-4 w-4 text-amber-400" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEditOrSign}
                        onClick={() => canEditOrSign && navigate(`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}&download=1`)}
                        title={canEditOrSign ? 'PDF herunterladen' : 'Erst nach Freigabe verfügbar'}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!isOrder && !isSigned && (
                        canEditOrSign ? (
                          <Button variant="ghost" size="icon" asChild title="Bearbeiten">
                            <Link to={`/verkauf/angebot/neu?edit=${encodeURIComponent(o.offerNumber)}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" disabled title="Erst nach Freigabe bearbeitbar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      {!isSigned && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!canEditOrSign}
                          onClick={() => canEditOrSign && openSignLink(o.offerNumber)}
                          title={canEditOrSign ? 'Unterschriftslink anzeigen' : 'Erst nach Freigabe verfügbar'}
                        >
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

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent key={approvalOffer?.offerNumber || 'none'} className="z-[100]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-400" /> Angebot freigeben</DialogTitle>
            <DialogDescription>
              {approvalOffer ? `Angebot ${approvalOffer.offerNumber} · ${approvalOffer.customer?.company_name || approvalOffer.customer?.contact_name || ''} · ${fmtMoney(approvalOffer.totals?.gross || 0)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Notiz (optional)</label>
            <Textarea rows={3} value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="z. B. Hinweise zur Freigabe…" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setApprovalOpen(false)} disabled={approvalBusy}>Abbrechen</Button>
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => submitApproval('rejected')} disabled={approvalBusy}>
              <ShieldX className="h-4 w-4 mr-2" /> Ablehnen
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => submitApproval('approved')} disabled={approvalBusy}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Freigeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input readOnly value={signLinkUrl} onFocus={(e) => e.currentTarget.select()} />
                <Button onClick={copySignLink} className="shrink-0"><Copy className="h-4 w-4 mr-2" />Kopieren</Button>
              </div>
              <a
                href={signLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-xs text-primary underline hover:no-underline"
              >
                {signLinkUrl}
              </a>
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
