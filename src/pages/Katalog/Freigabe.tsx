import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, ShieldAlert, Eye, CheckCircle2, XCircle } from 'lucide-react';

interface ItemPending {
  id: string;
  sku: string;
  name: string;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  last_edited_by: string | null;
}

interface PricePending {
  id: string;
  item_id: string;
  currency_code: string | null;
  standard_gross: number | null;
  price_status: string;
  submitted_at: string | null;
  last_edited_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  item?: { sku: string; name: string };
  country?: { iso2: string; name: string };
}

export default function KatalogFreigabe() {
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const client = supabase as any;
  const canApprove = (roles ?? []).some((r: string) => ['Super Admin', 'Admin', 'Katalog Preise'].includes(r));

  const [items, setItems] = useState<ItemPending[]>([]);
  const [prices, setPrices] = useState<PricePending[]>([]);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selItems, setSelItems] = useState<Record<string, boolean>>({});
  const [selPrices, setSelPrices] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: it }, { data: pr }] = await Promise.all([
      client.from('catalog_items').select('id, sku, name, status, submitted_at, submitted_by, last_edited_by')
        .eq('status', 'zur_pruefung').is('approved_at', null).order('submitted_at', { ascending: true }),
      client.from('catalog_item_prices').select('id, item_id, currency_code, standard_gross, price_status, submitted_at, last_edited_by, reviewed_by, reviewed_at, review_note, item:catalog_items(sku,name), country:catalog_countries(iso2,name)')
        .eq('price_status', 'zur_freigabe').is('approved_at', null).order('submitted_at', { ascending: true }),
    ]);
    setItems((it ?? []) as ItemPending[]);
    setPrices((pr ?? []) as PricePending[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime: Freigaben live nachladen, wenn andere Nutzer einreichen/ändern
  useEffect(() => {
    if (!canApprove) return;
    const ch = supabase
      .channel('katalog-freigabe-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_items' }, (payload: any) => {
        load();
        const row: any = payload.new ?? payload.old;
        if (payload.eventType === 'UPDATE' && row?.status === 'zur_pruefung' && row?.last_edited_by !== user?.id) {
          toast({ title: 'Neue Artikel-Prüfung eingegangen', description: row?.name ?? row?.sku ?? '' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_item_prices' }, (payload: any) => {
        load();
        const row: any = payload.new ?? payload.old;
        if (payload.eventType === 'UPDATE' && row?.price_status === 'zur_freigabe' && row?.last_edited_by !== user?.id) {
          toast({ title: 'Neuer Preis zur Freigabe', description: `${row?.currency_code ?? ''} ${row?.standard_gross ?? ''}` });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove, user?.id]);

  const eligibleItems = useMemo(() => items.filter((i) => i.last_edited_by !== user?.id), [items, user]);
  const eligiblePrices = useMemo(
    () => prices.filter((p) => p.last_edited_by !== user?.id && p.reviewed_at && p.reviewed_by !== user?.id),
    [prices, user],
  );
  const reviewablePrices = useMemo(
    () => prices.filter((p) => p.last_edited_by !== user?.id && !p.reviewed_at),
    [prices, user],
  );

  const approveItems = async () => {
    const ids = Object.entries(selItems).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await client.from('catalog_items').update({
      status: 'freigegeben', approved_at: now, approved_by: user?.id,
    }).in('id', ids);
    setBusy(false);
    if (error) return toast({ title: 'Freigabe fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: `${ids.length} Artikel freigegeben` });
    setSelItems({});
    load();
  };

  const rejectItems = async () => {
    const ids = Object.entries(selItems).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Artikel zurück auf „Korrektur" setzen?`)) return;
    setBusy(true);
    const { error } = await client.from('catalog_items').update({
      status: 'korrektur', submitted_at: null, submitted_by: null,
    }).in('id', ids);
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: `${ids.length} Artikel zurückgewiesen` });
    setSelItems({});
    load();
  };

  const reviewPrices = async () => {
    const ids = Object.entries(selPrices).filter(([, v]) => v).map(([k]) => k);
    const target = ids.filter((id) => reviewablePrices.some((p) => p.id === id));
    if (target.length === 0) return toast({ title: 'Nichts zu prüfen', description: 'Nur ungeprüfte, fremde Preise können geprüft werden.' });
    const note = window.prompt(`Prüfnotiz für ${target.length} Preis(e) (optional):`, '') ?? '';
    setBusy(true);
    const { error } = await client.from('catalog_item_prices').update({
      reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: note || null,
    }).in('id', target);
    setBusy(false);
    if (error) return toast({ title: 'Prüfung fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: `${target.length} Preise als geprüft markiert` });
    setSelPrices({});
    load();
  };

  const approvePrices = async () => {
    const ids = Object.entries(selPrices).filter(([, v]) => v).map(([k]) => k);
    const target = ids.filter((id) => eligiblePrices.some((p) => p.id === id));
    if (target.length === 0) return toast({ title: 'Freigabe nicht möglich', description: 'Nur von jemand anderem geprüfte Preise können freigegeben werden (4-Augen-Prinzip).' });
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await client.from('catalog_item_prices').update({
      price_status: 'freigegeben', approved_at: now, approved_by: user?.id,
    }).in('id', target);
    setBusy(false);
    if (error) return toast({ title: 'Freigabe fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: `${target.length} Preise freigegeben` });
    setSelPrices({});
    load();
  };

  const rejectPrices = async () => {
    const ids = Object.entries(selPrices).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Preise ablehnen?`)) return;
    setBusy(true);
    const { error } = await client.from('catalog_item_prices').update({ price_status: 'abgelehnt' }).in('id', ids);
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: `${ids.length} Preise abgelehnt` });
    setSelPrices({});
    load();
  };

  if (!canApprove) {
    return (
      <Card><CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-5 w-5" /> Nur Super Admin, Admin oder „Katalog Preise" können Freigaben vornehmen.
      </CardContent></Card>
    );
  }

  const selectAll = (rows: { id: string; last_edited_by: string | null }[], setter: (v: Record<string, boolean>) => void, on: boolean) => {
    const next: Record<string, boolean> = {};
    if (on) rows.filter((r) => r.last_edited_by !== user?.id).forEach((r) => { next[r.id] = true; });
    setter(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{items.length}</div>
            <div className="text-xs text-muted-foreground">Artikel zur Prüfung</div>
          </div>
          <ShieldCheck className="h-6 w-6 text-primary" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{prices.length}</div>
            <div className="text-xs text-muted-foreground">Preise zur Freigabe</div>
          </div>
          <ShieldCheck className="h-6 w-6 text-amber-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{items.length + prices.length - eligibleItems.length - eligiblePrices.length}</div>
            <div className="text-xs text-muted-foreground">Eigene Änderungen (nicht durch dich freigebbar)</div>
          </div>
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Artikel zur Prüfung</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={rejectItems} disabled={busy || Object.values(selItems).filter(Boolean).length === 0}>
              <XCircle className="h-4 w-4 mr-1" />Zurückweisen
            </Button>
            <Button size="sm" onClick={approveItems} disabled={busy || Object.values(selItems).filter(Boolean).length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Freigeben
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={eligibleItems.length > 0 && eligibleItems.every((i) => selItems[i.id])}
                    onCheckedChange={(v) => selectAll(items, setSelItems, !!v)}
                  />
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Eingereicht</TableHead>
                <TableHead>Hinweis</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Lade…</TableCell></TableRow>}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine Artikel zur Prüfung.</TableCell></TableRow>}
              {items.map((i) => {
                const own = i.last_edited_by === user?.id;
                return (
                  <TableRow key={i.id} className={own ? 'opacity-60' : ''}>
                    <TableCell>
                      <Checkbox disabled={own} checked={!!selItems[i.id]} onCheckedChange={(v) => setSelItems({ ...selItems, [i.id]: !!v })} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.submitted_at ? new Date(i.submitted_at).toLocaleString('de-DE') : '—'}</TableCell>
                    <TableCell>{own && <Badge variant="secondary" className="text-[10px]">von dir bearbeitet</Badge>}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/katalog/artikel/${i.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Preise zur Freigabe <span className="text-xs font-normal text-muted-foreground ml-2">(4-Augen-Prinzip: Prüfer ≠ Freigeber)</span></CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={rejectPrices} disabled={busy || Object.values(selPrices).filter(Boolean).length === 0}>
              <XCircle className="h-4 w-4 mr-1" />Ablehnen
            </Button>
            <Button size="sm" variant="secondary" onClick={reviewPrices} disabled={busy || Object.values(selPrices).filter(Boolean).length === 0}>
              <Eye className="h-4 w-4 mr-1" />Prüfen
            </Button>
            <Button size="sm" onClick={approvePrices} disabled={busy || Object.values(selPrices).filter(Boolean).length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Freigeben
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={prices.length > 0 && prices.filter((p) => p.last_edited_by !== user?.id).every((p) => selPrices[p.id])}
                    onCheckedChange={(v) => selectAll(prices, setSelPrices, !!v)}
                  />
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>Land</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eingereicht</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Lade…</TableCell></TableRow>}
              {!loading && prices.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Keine Preise zur Freigabe.</TableCell></TableRow>}
              {prices.map((p) => {
                const own = p.last_edited_by === user?.id;
                const reviewedByMe = p.reviewed_by === user?.id;
                return (
                  <TableRow key={p.id} className={own ? 'opacity-60' : ''}>
                    <TableCell>
                      <Checkbox disabled={own} checked={!!selPrices[p.id]} onCheckedChange={(v) => setSelPrices({ ...selPrices, [p.id]: !!v })} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.item?.sku ?? '—'}</TableCell>
                    <TableCell>{p.item?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs">{p.country?.iso2 ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.standard_gross != null ? `${Number(p.standard_gross).toFixed(2)} ${p.currency_code ?? ''}` : '—'}</TableCell>
                    <TableCell>
                      {p.reviewed_at ? (
                        <Badge variant={reviewedByMe ? 'secondary' : 'default'} className="text-[10px]" title={p.review_note ?? ''}>
                          geprüft {reviewedByMe ? '(von dir)' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">ungeprüft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.submitted_at ? new Date(p.submitted_at).toLocaleString('de-DE') : '—'}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/katalog/artikel/${p.item_id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
