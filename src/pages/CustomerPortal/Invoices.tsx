import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string };
type Row = {
  id: string;
  file_name: string;
  sent_at: string | null;
  created_at: string;
  status: string;
};

export default function CustomerPortalInvoices() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('alle');
  const [yearFilter, setYearFilter] = useState<string>('alle');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'neu' | 'alt'>('neu');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('mail_attachments')
        .select('id, file_name, sent_at, created_at, status')
        .eq('customer_id', ctx.customerId)
        .eq('document_type', 'Rechnung')
        .order('created_at', { ascending: false });
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const years = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(new Date(r.sent_at ?? r.created_at).getFullYear().toString()));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== 'alle') out = out.filter((r) => (r.status ?? '').toLowerCase() === statusFilter);
    if (yearFilter !== 'alle') out = out.filter((r) => new Date(r.sent_at ?? r.created_at).getFullYear().toString() === yearFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((r) => r.file_name.toLowerCase().includes(needle));
    }
    out = [...out].sort((a, b) => {
      const da = new Date(a.sent_at ?? a.created_at).getTime();
      const db = new Date(b.sent_at ?? b.created_at).getTime();
      return sort === 'neu' ? db - da : da - db;
    });
    return out;
  }, [rows, statusFilter, yearFilter, q, sort]);

  const download = async (r: Row) => {
    setBusyId(r.id);
    try {
      void logPortalAudit({
        action: 'invoice_opened',
        customerId: ctx.customerId,
        objectType: 'mail_attachment',
        objectId: r.id,
      });
      const { data, error } = await supabase.functions.invoke('portal-invoice-download', {
        body: { attachment_id: r.id },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Download fehlgeschlagen');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e?.message ?? 'Download fehlgeschlagen');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Rechnungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Rechnungsnummer suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="bezahlt">Bezahlt</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="überfällig">Überfällig</SelectItem>
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger><SelectValue placeholder="Jahr" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Jahre</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neu">Neueste zuerst</SelectItem>
              <SelectItem value="alt">Älteste zuerst</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Keine Rechnungen gefunden.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnung</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.file_name}</TableCell>
                    <TableCell className="text-xs">{new Date(r.sent_at ?? r.created_at).toLocaleDateString('de-DE')}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => download(r)}>
                        {busyId === r.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Der Download-Link ist aus Sicherheitsgründen nur 60 Sekunden gültig. Bei Fragen wenden Sie sich bitte an unsere Buchhaltung.
        </p>
      </CardContent>
    </Card>
  );
}
