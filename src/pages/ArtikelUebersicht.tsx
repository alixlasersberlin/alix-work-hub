import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, PackageCheck, BookOpen, Plus } from 'lucide-react';
import { format } from 'date-fns';

type Receipt = {
  id: string;
  created_at: string;
  item_id: string;
  item_name: string | null;
  item_sku: string | null;
  quantity: number;
  supplier: string | null;
  reference: string | null;
  note: string | null;
};

const STORAGE_KEY = 'wareneingang_receipts_v1';

export default function ArtikelUebersicht() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setReceipts(JSON.parse(raw));
    } catch {}
  }, []);

  const stats = useMemo(() => {
    const totalQty = receipts.reduce((s, r) => s + (r.quantity || 0), 0);
    const last7 = receipts.filter(r => Date.now() - new Date(r.created_at).getTime() < 7 * 24 * 3600 * 1000);
    const last7Qty = last7.reduce((s, r) => s + (r.quantity || 0), 0);
    const uniqueItems = new Set(receipts.map(r => r.item_id)).size;
    return { count: receipts.length, totalQty, last7Count: last7.length, last7Qty, uniqueItems };
  }, [receipts]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Artikel – Übersicht</h1>
            <p className="text-muted-foreground text-sm">Letzte Wareneingänge und Schnellzugriff auf Artikel-Funktionen.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/verkauf/artikel"><Package className="h-4 w-4 mr-2" />Alle Artikel</Link></Button>
          <Button asChild variant="outline"><Link to="/verkauf/artikel/katalog"><BookOpen className="h-4 w-4 mr-2" />Katalog</Link></Button>
          <Button asChild><Link to="/verkauf/artikel/wareneingang"><Plus className="h-4 w-4 mr-2" />Wareneingang buchen</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Buchungen gesamt</p>
          <p className="text-2xl font-bold mt-1">{stats.count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Menge gesamt</p>
          <p className="text-2xl font-bold mt-1">{stats.totalQty}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Letzte 7 Tage</p>
          <p className="text-2xl font-bold mt-1">{stats.last7Count} <span className="text-sm font-normal text-muted-foreground">({stats.last7Qty} Stk.)</span></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Verschiedene Artikel</p>
          <p className="text-2xl font-bold mt-1">{stats.uniqueItems}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" />Letzte Wareneingänge</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/verkauf/artikel/wareneingang">Alle anzeigen →</Link></Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Lieferschein</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Noch keine Wareneingänge erfasst. <Link to="/verkauf/artikel/wareneingang" className="text-primary underline ml-1">Jetzt erfassen</Link>
                </TableCell></TableRow>
              )}
              {receipts.slice(0, 15).map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                  <TableCell className="font-medium">{r.item_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.item_sku || '—'}</TableCell>
                  <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                  <TableCell>{r.supplier || '—'}</TableCell>
                  <TableCell>{r.reference || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
