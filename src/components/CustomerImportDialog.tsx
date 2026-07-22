import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, SkipForward, AlertTriangle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

type Row = Record<string, any>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported?: () => void;
}

const FIELD_MAP: Record<string, string> = {
  // company
  company: 'company_name', company_name: 'company_name', firma: 'company_name', firmenname: 'company_name', unternehmen: 'company_name', name: 'company_name',
  // contact
  contact: 'contact_name', contact_name: 'contact_name', kontakt: 'contact_name', ansprechpartner: 'contact_name', vorname_nachname: 'contact_name',
  // email
  email: 'email', 'e-mail': 'email', mail: 'email', 'email address': 'email', emailadresse: 'email',
  // phone
  phone: 'phone', telefon: 'phone', tel: 'phone', 'phone number': 'phone', rufnummer: 'phone',
  // number
  external_customer_id: 'external_customer_id', customer_number: 'external_customer_id', kundennummer: 'external_customer_id', 'kunden-nr': 'external_customer_id', kundennr: 'external_customer_id',
  // address parts
  street: 'street', strasse: 'street', straße: 'street', address: 'street', adresse: 'street',
  city: 'city', stadt: 'city', ort: 'city',
  postal_code: 'postal_code', plz: 'postal_code', zip: 'postal_code', postleitzahl: 'postal_code',
  country: 'country', land: 'country',
};

function normKey(k: string) {
  return String(k || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function mapRow(raw: Row): Row {
  const out: Row = {};
  const billing: Row = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k);
    const target = FIELD_MAP[nk];
    if (!target || v == null || v === '') continue;
    if (['street', 'city', 'postal_code', 'country'].includes(target)) {
      billing[target] = String(v).trim();
    } else {
      out[target] = String(v).trim();
    }
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

export default function CustomerImportDialog({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number; details: { row: number; status: 'created' | 'skipped' | 'failed'; label: string; reason?: string }[] } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setResult(null);
    try {
      const parsed = await parseFile(f);
      setRows(parsed);
      toast.success(`${parsed.length} Zeilen erkannt`);
    } catch (err: any) {
      toast.error('Parsen fehlgeschlagen: ' + err.message);
      setRows([]);
    }
  }

  async function runImport() {
    if (!rows.length) return;
    setBusy(true);
    setResult(null);
    try {
      // Load existing keys for duplicate detection (paginated).
      const emails = new Set<string>();
      const numbers = new Set<string>();
      const nameKeys = new Set<string>();
      const CHUNK = 1000;
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from('customers')
          .select('email, external_customer_id, company_name, phone')
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        for (const c of data as any[]) {
          if (c.email) emails.add(String(c.email).toLowerCase().trim());
          if (c.external_customer_id) numbers.add(String(c.external_customer_id).trim());
          if (c.company_name) nameKeys.add(`${String(c.company_name).toLowerCase().trim()}|${String(c.phone || '').trim()}`);
        }
        if (data.length < CHUNK) break;
      }

      const details: any[] = [];
      let created = 0, skipped = 0, failed = 0;

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const mapped = mapRow(raw);
        const label = mapped.company_name || mapped.contact_name || mapped.email || `Zeile ${i + 2}`;
        if (!mapped.company_name && !mapped.contact_name && !mapped.email) {
          failed++;
          details.push({ row: i + 2, status: 'failed', label, reason: 'Kein Name/Email' });
          continue;
        }
        const emailKey = mapped.email ? String(mapped.email).toLowerCase().trim() : '';
        const numKey = mapped.external_customer_id ? String(mapped.external_customer_id).trim() : '';
        const nameKey = mapped.company_name ? `${String(mapped.company_name).toLowerCase().trim()}|${String(mapped.phone || '').trim()}` : '';

        const dupe =
          (emailKey && emails.has(emailKey)) ||
          (numKey && numbers.has(numKey)) ||
          (nameKey && nameKeys.has(nameKey));

        if (dupe) {
          skipped++;
          details.push({ row: i + 2, status: 'skipped', label, reason: 'Bereits vorhanden' });
          continue;
        }

        const { error } = await supabase.from('customers').insert({
          ...mapped,
          source_system: mapped.source_system || 'manual_import',
        } as any);
        if (error) {
          failed++;
          details.push({ row: i + 2, status: 'failed', label, reason: error.message });
        } else {
          created++;
          if (emailKey) emails.add(emailKey);
          if (numKey) numbers.add(numKey);
          if (nameKey) nameKeys.add(nameKey);
          details.push({ row: i + 2, status: 'created', label });
        }
      }

      setResult({ created, skipped, failed, details });
      toast.success(`Import fertig: ${created} neu, ${skipped} übersprungen, ${failed} Fehler`);
      onImported?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
            <p className="font-medium">Duplikat-Erkennung:</p>
            <p>Ein Kunde gilt als vorhanden, wenn <b>E-Mail</b>, <b>Kundennummer</b> oder <b>Firmenname + Telefon</b> übereinstimmen.</p>
            <p>Unterstützte Spalten: company_name/firma, contact_name/ansprechpartner, email, phone/telefon, external_customer_id/kundennummer, street/strasse, postal_code/plz, city/ort, country/land.</p>
          </div>

          {rows.length > 0 && !result && (
            <div className="rounded-md border border-border/60">
              <div className="p-2 text-xs bg-muted/40">Vorschau — {rows.length} Zeilen</div>
              <div className="max-h-56 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left">
                      {Object.keys(rows[0]).slice(0, 6).map((k) => <th key={k} className="p-2 border-b">{k}</th>)}
                    </tr>
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

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40"><CheckCircle2 className="w-3 h-3 mr-1" />{result.created} neu angelegt</Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40"><SkipForward className="w-3 h-3 mr-1" />{result.skipped} übersprungen</Badge>
                {result.failed > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/40"><AlertTriangle className="w-3 h-3 mr-1" />{result.failed} Fehler</Badge>}
              </div>
              <div className="rounded-md border border-border/60 max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left">
                      <th className="p-2 border-b">Zeile</th>
                      <th className="p-2 border-b">Status</th>
                      <th className="p-2 border-b">Kunde</th>
                      <th className="p-2 border-b">Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{d.row}</td>
                        <td className="p-2">
                          {d.status === 'created' && <span className="text-emerald-400">Neu</span>}
                          {d.status === 'skipped' && <span className="text-amber-400">Übersprungen</span>}
                          {d.status === 'failed' && <span className="text-red-400">Fehler</span>}
                        </td>
                        <td className="p-2">{d.label}</td>
                        <td className="p-2 text-muted-foreground">{d.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => { setRows([]); setResult(null); setFilename(''); onOpenChange(false); }}>Schließen</Button>
          <Button onClick={runImport} disabled={busy || !rows.length} className="gold-gradient text-primary-foreground">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importiere…</> : <><Upload className="w-4 h-4 mr-2" />{rows.length} Kunden abgleichen & importieren</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
