import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle2, SkipForward, AlertTriangle, Loader2, Download, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

type Row = Record<string, any>;
type MatchMode = 'email_and_name' | 'email_or_name' | 'email_only' | 'name_only';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported?: () => void;
}

const FIELD_MAP: Record<string, string> = {
  company: 'company_name', company_name: 'company_name', firma: 'company_name', firmenname: 'company_name', unternehmen: 'company_name', name: 'company_name',
  contact: 'contact_name', contact_name: 'contact_name', kontakt: 'contact_name', ansprechpartner: 'contact_name', vorname_nachname: 'contact_name',
  email: 'email', 'e-mail': 'email', mail: 'email', 'email address': 'email', emailadresse: 'email',
  phone: 'phone', telefon: 'phone', tel: 'phone', 'phone number': 'phone', rufnummer: 'phone',
  external_customer_id: 'external_customer_id', customer_number: 'external_customer_id', kundennummer: 'external_customer_id', 'kunden-nr': 'external_customer_id', kundennr: 'external_customer_id',
  street: 'street', strasse: 'street', straße: 'street', address: 'street', adresse: 'street',
  city: 'city', stadt: 'city', ort: 'city',
  postal_code: 'postal_code', plz: 'postal_code', zip: 'postal_code', postleitzahl: 'postal_code',
  country: 'country', land: 'country',
};

function normKey(k: string) { return String(k || '').trim().toLowerCase().replace(/\s+/g, '_'); }
function normName(s: any) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function normEmail(s: any) { return String(s || '').toLowerCase().trim(); }

function mapRow(raw: Row): Row {
  const out: Row = {};
  const billing: Row = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k);
    const target = FIELD_MAP[nk];
    if (!target || v == null || v === '') continue;
    if (['street', 'city', 'postal_code', 'country'].includes(target)) billing[target] = String(v).trim();
    else out[target] = String(v).trim();
  }
  if (Object.keys(billing).length) out.billing_address = billing;
  return out;
}

async function parseFile(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xml')) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Ungültiges XML');
    const nodes = Array.from(doc.querySelectorAll('customer, kunde, row, record, item'));
    if (!nodes.length) throw new Error('Keine <customer>/<kunde>/<row>-Einträge gefunden');
    return nodes.map((n) => {
      const row: Row = {};
      Array.from(n.children).forEach((c) => { row[c.tagName] = c.textContent?.trim() || ''; });
      Array.from(n.attributes).forEach((a) => { row[a.name] = a.value; });
      return row;
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
}

interface CompareRow {
  row: number;
  mapped: Row;
  label: string;
  status: 'new' | 'duplicate' | 'invalid';
  reason?: string;
  matchedBy?: string[];
  existingId?: string;
  existingLabel?: string;
  selected: boolean;
}

export default function CustomerImportDialog({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('email_and_name');
  const [compare, setCompare] = useState<CompareRow[] | null>(null);
  const [summary, setSummary] = useState<{ created: number; skipped: number; failed: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name); setCompare(null); setSummary(null);
    try {
      const parsed = await parseFile(f);
      setRows(parsed);
      toast.success(`${parsed.length} Zeilen erkannt – starte Vergleich…`);
      // Auto-run comparison so the user immediately sees the full result
      setTimeout(() => runCompareWith(parsed), 50);
    } catch (err: any) {
      toast.error('Parsen fehlgeschlagen: ' + err.message);
      setRows([]);
    }
  }

  async function runCompareWith(sourceRows: Row[]) {
    if (!sourceRows.length) return;
    // Temporarily swap rows so runCompare uses the just-parsed data
    setRows(sourceRows);
    await runCompareInternal(sourceRows);
  }

  async function runCompare() {
    if (!rows.length) return;
    setBusy(true); setCompare(null); setSummary(null);
    try {
      // Load existing customers for duplicate detection
      const existing: { id: string; email: string; name: string; company_name: string; external_customer_id: string; phone: string }[] = [];
      const CHUNK = 1000;
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, email, company_name, contact_name, external_customer_id, phone')
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        for (const c of data as any[]) {
          existing.push({
            id: c.id,
            email: normEmail(c.email),
            name: normName(c.company_name || c.contact_name),
            company_name: c.company_name || c.contact_name || '',
            external_customer_id: c.external_customer_id || '',
            phone: c.phone || '',
          });
        }
        if (data.length < CHUNK) break;
      }

      const emailIx = new Map<string, typeof existing[number]>();
      const nameIx = new Map<string, typeof existing[number]>();
      for (const e of existing) {
        if (e.email) emailIx.set(e.email, e);
        if (e.name) nameIx.set(e.name, e);
      }

      const out: CompareRow[] = rows.map((raw, i) => {
        const mapped = mapRow(raw);
        const label = mapped.company_name || mapped.contact_name || mapped.email || `Zeile ${i + 2}`;
        if (!mapped.company_name && !mapped.contact_name && !mapped.email) {
          return { row: i + 2, mapped, label, status: 'invalid', reason: 'Kein Name/Email', selected: false };
        }
        const e = normEmail(mapped.email);
        const n = normName(mapped.company_name || mapped.contact_name);
        const emailHit = e ? emailIx.get(e) : undefined;
        const nameHit = n ? nameIx.get(n) : undefined;

        let dupe: typeof existing[number] | undefined;
        const matchedBy: string[] = [];
        if (matchMode === 'email_and_name') {
          if (emailHit && nameHit && emailHit.id === nameHit.id) { dupe = emailHit; matchedBy.push('E-Mail', 'Name'); }
        } else if (matchMode === 'email_or_name') {
          if (emailHit) { dupe = emailHit; matchedBy.push('E-Mail'); }
          else if (nameHit) { dupe = nameHit; matchedBy.push('Name'); }
        } else if (matchMode === 'email_only') {
          if (emailHit) { dupe = emailHit; matchedBy.push('E-Mail'); }
        } else if (matchMode === 'name_only') {
          if (nameHit) { dupe = nameHit; matchedBy.push('Name'); }
        }

        if (dupe) {
          return { row: i + 2, mapped, label, status: 'duplicate', matchedBy, existingId: dupe.id, existingLabel: dupe.company_name, selected: false };
        }
        return { row: i + 2, mapped, label, status: 'new', selected: true };
      });

      setCompare(out);
      const nc = out.filter(r => r.status === 'new').length;
      const dc = out.filter(r => r.status === 'duplicate').length;
      const ic = out.filter(r => r.status === 'invalid').length;
      toast.success(`Vergleich fertig: ${nc} neu, ${dc} Duplikate, ${ic} ungültig`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function importOne(idx: number) {
    if (!compare) return;
    const r = compare[idx];
    if (r.status === 'invalid') return;
    const { error } = await supabase.from('customers').insert({ ...r.mapped, source_system: r.mapped.source_system || 'manual_import' } as any);
    if (error) { toast.error(`${r.label}: ${error.message}`); return; }
    const next = [...compare];
    next[idx] = { ...r, status: 'new', reason: 'Manuell übernommen', selected: false };
    // Mark as done by moving to a "created" marker via reason; keep status new but disable button:
    next[idx].existingId = 'imported';
    setCompare(next);
    toast.success(`${r.label} angelegt`);
    onImported?.();
  }

  async function importSelected() {
    if (!compare) return;
    setBusy(true);
    let created = 0, skipped = 0, failed = 0;
    const next = [...compare];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      if (!r.selected || r.status === 'invalid' || r.existingId === 'imported') { if (!r.selected) skipped++; continue; }
      const { error } = await supabase.from('customers').insert({ ...r.mapped, source_system: r.mapped.source_system || 'manual_import' } as any);
      if (error) { failed++; next[i] = { ...r, reason: error.message, selected: false }; }
      else { created++; next[i] = { ...r, existingId: 'imported', selected: false, reason: 'Übernommen' }; }
    }
    setCompare(next);
    setSummary({ created, skipped, failed });
    setBusy(false);
    toast.success(`${created} übernommen, ${failed} Fehler`);
    onImported?.();
  }

  function toggleAllNew(v: boolean) {
    if (!compare) return;
    setCompare(compare.map(r => r.status === 'new' && r.existingId !== 'imported' ? { ...r, selected: v } : r));
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([{
      company_name: 'Beispiel GmbH', contact_name: 'Max Mustermann', email: 'max@beispiel.de',
      phone: '+49 30 1234567', external_customer_id: 'K-1001',
      street: 'Musterstraße 1', postal_code: '10115', city: 'Berlin', country: 'DE',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
    XLSX.writeFile(wb, 'kunden-import-vorlage.xlsx');
  }

  const counts = compare ? {
    total: compare.length,
    neu: compare.filter(r => r.status === 'new' && r.existingId !== 'imported').length,
    dup: compare.filter(r => r.status === 'duplicate').length,
    inv: compare.filter(r => r.status === 'invalid').length,
    done: compare.filter(r => r.existingId === 'imported').length,
    sel: compare.filter(r => r.selected).length,
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Kunden importieren (CSV / XLSX / XML)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept=".csv,.xlsx,.xls,.xml" onChange={onFile} className="max-w-md" />
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Vorlage
            </Button>
            {filename && <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" />{filename}</span>}
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium">Duplikat-Erkennung — Vergleichsmodus:</p>
            <RadioGroup value={matchMode} onValueChange={(v) => setMatchMode(v as MatchMode)} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="email_and_name" id="mm1" className="mt-0.5" />
                <div><div className="font-medium">Name UND E-Mail</div><div className="text-muted-foreground">Nur überspringen, wenn beide übereinstimmen (streng)</div></div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="email_or_name" id="mm2" className="mt-0.5" />
                <div><div className="font-medium">Name ODER E-Mail</div><div className="text-muted-foreground">Überspringen, wenn eines von beiden übereinstimmt</div></div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="email_only" id="mm3" className="mt-0.5" />
                <div><div className="font-medium">Nur E-Mail</div><div className="text-muted-foreground">Vergleich ausschließlich per E-Mail-Adresse</div></div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="name_only" id="mm4" className="mt-0.5" />
                <div><div className="font-medium">Nur Name</div><div className="text-muted-foreground">Vergleich ausschließlich per Firmen-/Kontaktname</div></div>
              </label>
            </RadioGroup>
          </div>

          {rows.length > 0 && !compare && (
            <div className="rounded-md border border-border/60">
              <div className="p-2 text-xs bg-muted/40">Vorschau — {rows.length} Zeilen</div>
              <div className="max-h-56 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left">{Object.keys(rows[0]).slice(0, 6).map((k) => <th key={k} className="p-2 border-b">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t">
                        {Object.keys(rows[0]).slice(0, 6).map((k) => <td key={k} className="p-2">{String(r[k] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {counts && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40"><CheckCircle2 className="w-3 h-3 mr-1" />{counts.neu} neu</Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40"><SkipForward className="w-3 h-3 mr-1" />{counts.dup} Duplikate</Badge>
                {counts.inv > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/40"><AlertTriangle className="w-3 h-3 mr-1" />{counts.inv} ungültig</Badge>}
                {counts.done > 0 && <Badge className="bg-primary/20 text-primary border-primary/40">{counts.done} übernommen</Badge>}
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={() => toggleAllNew(true)}>Alle „Neu" wählen</Button>
                <Button size="sm" variant="outline" onClick={() => toggleAllNew(false)}>Auswahl leeren</Button>
                <Button size="sm" onClick={importSelected} disabled={busy || counts.sel === 0} className="gold-gradient text-primary-foreground">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {counts.sel} übernehmen
                </Button>
              </div>

              <div className="rounded-md border border-border/60 max-h-[420px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="text-left">
                      <th className="p-2 border-b w-8"></th>
                      <th className="p-2 border-b">Zeile</th>
                      <th className="p-2 border-b">Status</th>
                      <th className="p-2 border-b">Kunde (Datei)</th>
                      <th className="p-2 border-b">E-Mail</th>
                      <th className="p-2 border-b">Bestehender Kunde</th>
                      <th className="p-2 border-b">Hinweis</th>
                      <th className="p-2 border-b text-right">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compare!.map((d, i) => {
                      const done = d.existingId === 'imported';
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2">
                            {d.status === 'new' && !done && (
                              <Checkbox checked={d.selected} onCheckedChange={(v) => {
                                const n = [...compare!]; n[i] = { ...d, selected: !!v }; setCompare(n);
                              }} />
                            )}
                          </td>
                          <td className="p-2">{d.row}</td>
                          <td className="p-2">
                            {done && <span className="text-primary">Übernommen</span>}
                            {!done && d.status === 'new' && <span className="text-emerald-400">Neu</span>}
                            {!done && d.status === 'duplicate' && <span className="text-amber-400">Duplikat</span>}
                            {!done && d.status === 'invalid' && <span className="text-red-400">Ungültig</span>}
                          </td>
                          <td className="p-2">{d.label}</td>
                          <td className="p-2 text-muted-foreground">{d.mapped.email || '—'}</td>
                          <td className="p-2 text-muted-foreground">
                            {d.existingLabel ? (
                              <div>
                                <div>{d.existingLabel}</div>
                                {d.matchedBy && <div className="text-[10px] uppercase tracking-wide">Match: {d.matchedBy.join(' + ')}</div>}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="p-2 text-muted-foreground">{d.reason || '—'}</td>
                          <td className="p-2 text-right">
                            {!done && d.status !== 'invalid' && (
                              <Button size="sm" variant={d.status === 'duplicate' ? 'outline' : 'default'} onClick={() => importOne(i)}>
                                <UserPlus className="w-3 h-3 mr-1" />
                                {d.status === 'duplicate' ? 'Trotzdem anlegen' : 'Übernehmen'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {summary && (
                <p className="text-xs text-muted-foreground">
                  Letzter Lauf: {summary.created} angelegt · {summary.failed} Fehler
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => { setRows([]); setCompare(null); setSummary(null); setFilename(''); onOpenChange(false); }}>Schließen</Button>
          {!compare && (
            <Button onClick={runCompare} disabled={busy || !rows.length} className="gold-gradient text-primary-foreground">
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vergleiche…</> : <><Search className="w-4 h-4 mr-2" />{rows.length} Zeilen vergleichen</>}
            </Button>
          )}
          {compare && (
            <Button variant="outline" onClick={() => { setCompare(null); setSummary(null); }}>Neu vergleichen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
