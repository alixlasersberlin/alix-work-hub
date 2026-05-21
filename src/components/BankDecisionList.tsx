import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Loader2, Inbox, Eye, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  status: 'approved' | 'rejected' | 'pending' | Array<'approved' | 'rejected' | 'pending' | 'in_review'>;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyText: string;
  allowDelete?: boolean;
}

export default function BankDecisionList({ status, title, subtitle, icon: Icon, emptyText, allowDelete = false }: Props) {
  const [toDelete, setToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error: err } = await supabase
      .from('bank_financing_requests')
      .delete()
      .eq('id', toDelete.id);
    setDeleting(false);
    if (err) {
      toast.error('Löschen fehlgeschlagen: ' + err.message);
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== toDelete.id));
    toast.success('Anfrage gelöscht. Auftrag steht wieder unter „Verfügbare Aufträge".');
    setToDelete(null);
  };

  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from('bank_financing_requests')
        .select('id, status, decided_at, decision_note, order_id, orders(id, order_number, order_date, total_amount, currency, order_status, customers(company_name, contact_name))')
        .order('decided_at', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (Array.isArray(status)) q = q.in('status', status);
      else q = q.eq('status', status);
      const { data, error: err } = await q;
      if (err) setError(err.message);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [Array.isArray(status) ? status.join(',') : status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const o = r.orders;
      const name = o?.customers?.company_name || o?.customers?.contact_name || '';
      return (o?.order_number || '').toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });
  }, [rows, search]);

  const fmtMoney = (v: number | null, c?: string | null) =>
    v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Icon className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>Übersicht ({filtered.length})</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche Auftrag / Kunde…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-destructive text-sm py-10 text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">{emptyText}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auftragsnr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Auftragsdatum</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Entscheidung am</TableHead>
                    {status === 'rejected' && <TableHead>Grund</TableHead>}
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const o = r.orders;
                    if (!o) return null;
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>
                        <TableCell className="font-medium">{o.order_number || '—'}</TableCell>
                        <TableCell>{o.customers?.company_name || o.customers?.contact_name || '—'}</TableCell>
                        <TableCell>{fmtDate(o.order_date)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(o.total_amount, o.currency)}</TableCell>
                        <TableCell>{r.decided_at ? new Date(r.decided_at).toLocaleDateString('de-DE') : '—'}</TableCell>
                        {status === 'rejected' && (
                          <TableCell className="max-w-[260px] truncate text-muted-foreground" title={r.decision_note || ''}>
                            {r.decision_note || '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); navigate(`/auftraege/${o.id}`); }}
                              title="Auftrag öffnen"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {allowDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
                                title="Anfrage löschen"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anfrage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Finanzierungs-Anfrage für Auftrag{' '}
              <span className="font-medium">{toDelete?.orders?.order_number || '—'}</span>{' '}
              wird gelöscht. Der Auftrag erscheint danach wieder unter „Verfügbare Aufträge".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Lösche…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
