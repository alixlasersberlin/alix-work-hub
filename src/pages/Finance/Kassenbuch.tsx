import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, Undo2, Upload, FileText, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';

const fmt = (n: number) => (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const todayISO = () => new Date().toISOString().slice(0, 10);

type Row = any;

export default function Kassenbuch() {
  const { canWrite } = useFinancePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01');
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<string>('alle');
  const [openNew, setOpenNew] = useState(false);
  const [openClose, setOpenClose] = useState(false);

  // Form state
  const empty = {
    booking_type: 'einnahme', amount_net: 0, vat_rate: 19, amount_vat: 0, amount_gross: 0,
    payment_method: 'Bar', description: '', document_number: '', cost_center: '',
    file: null as File | null,
  };
  const [form, setForm] = useState<typeof empty>(empty);
  const [closing, setClosing] = useState({ counted: 0, note: '' });

  async function load() {
    setLoading(true);
    let q: any = (supabase as any).from('finance_cashbook').select('*').gte('booking_date', from).lte('booking_date', to).order('booking_date', { ascending: false }).order('booking_time', { ascending: false });
    if (type !== 'alle') q = q.eq('booking_type', type);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-line */ }, [from, to, type]);

  const sums = useMemo(() => {
    const active = rows.filter(r => r.status === 'aktiv');
    const ein = active.filter(r => r.booking_type === 'einnahme').reduce((s, r) => s + Number(r.amount_gross || 0), 0);
    const aus = active.filter(r => r.booking_type === 'ausgabe').reduce((s, r) => s + Number(r.amount_gross || 0), 0);
    return { ein, aus, bestand: ein - aus };
  }, [rows]);

  function recalcGross(net: number, rate: number) {
    const vat = +(net * (rate / 100)).toFixed(2);
    return { vat, gross: +(net + vat).toFixed(2) };
  }

  async function save() {
    if (!canWrite) return;
    try {
      let attachment_path: string | null = null;
      if (form.file) {
        const path = `${todayISO()}/${crypto.randomUUID()}-${form.file.name}`;
        const up = await supabase.storage.from('finance-cashbook').upload(path, form.file);
        if (up.error) throw up.error;
        attachment_path = path;
      }
      const { vat, gross } = recalcGross(Number(form.amount_net), Number(form.vat_rate));
      const { error } = await (supabase as any).from('finance_cashbook').insert({
        booking_type: form.booking_type,
        amount_net: form.amount_net,
        vat_rate: form.vat_rate,
        amount_vat: vat,
        amount_gross: gross,
        payment_method: form.payment_method,
        description: form.description,
        document_number: form.document_number || null,
        cost_center: form.cost_center || null,
        attachment_path,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success('Buchung gespeichert');
      setOpenNew(false); setForm(empty); load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function reverse(id: string) {
    const reason = prompt('Storno-Grund?'); if (reason === null) return;
    const { error } = await (supabase as any).rpc('cashbook_reverse', { _id: id, _reason: reason });
    if (error) toast.error(error.message); else { toast.success('Storniert'); load(); }
  }

  async function doClosure() {
    const { error } = await (supabase as any).from('finance_cashbook_closures').insert({
      closure_date: todayISO(),
      opening_balance: 0,
      calculated_balance: sums.bestand,
      counted_balance: Number(closing.counted),
      note: closing.note,
      status: 'offen',
    });
    if (error) toast.error(error.message); else { toast.success('Tagesabschluss gespeichert'); setOpenClose(false); setClosing({ counted: 0, note: '' }); }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={BookOpen} title="Kassenbuch" subtitle="Revisionssichere Erfassung aller Barbewegungen (GoBD)"
        actions={canWrite ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenClose(true)}><FileText className="mr-2 h-4 w-4" />Tagesabschluss</Button>
            <Button onClick={() => setOpenNew(true)}><Plus className="mr-2 h-4 w-4" />Neue Buchung</Button>
          </div>
        ) : undefined} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Einnahmen (Filter)" value={fmt(sums.ein)} icon={BookOpen} accent="emerald" />
        <KpiTile label="Ausgaben (Filter)" value={fmt(sums.aus)} icon={BookOpen} accent="rose" />
        <KpiTile label="Kassenbestand (rechnerisch)" value={fmt(sums.bestand)} icon={BookOpen} accent="gold" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" />Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="min-w-[180px]"><Label>Typ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="einnahme">Einnahmen</SelectItem>
                <SelectItem value="ausgabe">Ausgaben</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Buchungen ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beleg-Nr.</TableHead><TableHead>Datum</TableHead><TableHead>Typ</TableHead>
                <TableHead>Beschreibung</TableHead><TableHead>Zahlungsart</TableHead>
                <TableHead className="text-right">Netto</TableHead><TableHead className="text-right">MwSt.</TableHead>
                <TableHead className="text-right">Brutto</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={10}>Lädt…</TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Keine Einträge</TableCell></TableRow>
                : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.booking_number}</TableCell>
                    <TableCell>{r.booking_date}</TableCell>
                    <TableCell><Badge variant={r.booking_type === 'einnahme' ? 'default' : 'secondary'}>{r.booking_type}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell>{r.payment_method}</TableCell>
                    <TableCell className="text-right">{fmt(r.amount_net)}</TableCell>
                    <TableCell className="text-right">{fmt(r.amount_vat)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.amount_gross)}</TableCell>
                    <TableCell><Badge variant={r.status === 'aktiv' ? 'outline' : 'destructive'}>{r.status}</Badge></TableCell>
                    <TableCell>
                      {canWrite && r.status === 'aktiv' && (
                        <Button size="sm" variant="ghost" onClick={() => reverse(r.id)}><Undo2 className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Neue Buchung */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Neue Kassenbuchung</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Typ</Label>
              <Select value={form.booking_type} onValueChange={v => setForm({ ...form, booking_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="einnahme">Einnahme</SelectItem>
                  <SelectItem value="ausgabe">Ausgabe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Zahlungsart</Label>
              <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Bar','EC','Kreditkarte','Überweisung','Lastschrift'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Netto (€)</Label><Input type="number" step="0.01" value={form.amount_net} onChange={e => setForm({ ...form, amount_net: Number(e.target.value) })} /></div>
            <div><Label>MwSt.-Satz (%)</Label><Input type="number" step="0.1" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: Number(e.target.value) })} /></div>
            <div className="col-span-2 text-sm text-muted-foreground">
              Brutto: <strong>{fmt(recalcGross(form.amount_net, form.vat_rate).gross)}</strong> · MwSt.: {fmt(recalcGross(form.amount_net, form.vat_rate).vat)}
            </div>
            <div><Label>Belegnummer</Label><Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} /></div>
            <div><Label>Kostenstelle</Label><Input value={form.cost_center} onChange={e => setForm({ ...form, cost_center: e.target.value })} /></div>
            <div className="col-span-2"><Label>Buchungstext</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="col-span-2"><Label><Upload className="inline h-4 w-4 mr-1" />Beleg (PDF/Bild)</Label>
              <Input type="file" accept=".pdf,image/*" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tagesabschluss */}
      <Dialog open={openClose} onOpenChange={setOpenClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tagesabschluss {todayISO()}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Sollbestand (rechnerisch): <strong>{fmt(sums.bestand)}</strong></div>
            <div><Label>Istbestand (Zählbestand €)</Label><Input type="number" step="0.01" value={closing.counted} onChange={e => setClosing({ ...closing, counted: Number(e.target.value) })} /></div>
            <div><Label>Differenz</Label><div className="font-semibold">{fmt(Number(closing.counted) - sums.bestand)}</div></div>
            <div><Label>Notiz</Label><Textarea value={closing.note} onChange={e => setClosing({ ...closing, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenClose(false)}>Abbrechen</Button>
            <Button onClick={doClosure}>Abschluss speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
