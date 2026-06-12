import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, FilePlus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const KEY = 'alix_angebote_v1';

type SavedOffer = {
  offerNumber: string;
  offerDate: string;
  validUntil?: string;
  customer?: { company_name?: string; contact_name?: string; email?: string } | null;
  totals?: { net: number; tax: number; gross: number };
  createdAt: string;
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
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map(o => (
                  <TableRow key={o.offerNumber}>
                    <TableCell className="font-medium">{o.offerNumber}</TableCell>
                    <TableCell>{o.offerDate ? new Date(o.offerDate).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell>{o.customer?.company_name || o.customer?.contact_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{o.customer?.email || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(o.totals?.gross || 0)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(o.offerNumber)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
