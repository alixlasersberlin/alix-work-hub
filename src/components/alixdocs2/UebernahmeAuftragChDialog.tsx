import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CH_BRANCH_ID = '598077000000065075';

type Customer = { id: string; company_name?: string | null; contact_name?: string | null; email?: string | null };

type AiEntities = {
  kunde_name?: string | null;
  kunde_nr?: string | null;
  auftrag_nr?: string | null;
  rechnung_nr?: string | null;
  angebot_nr?: string | null;
  serien_nr?: string | null;
  betrag_netto?: number | null;
  betrag_brutto?: number | null;
  waehrung?: string | null;
  mwst_prozent?: number | null;
  datum?: string | null;
  email?: string | null;
  telefon?: string | null;
  adresse?: string | null;
  positionen?: Array<{ beschreibung?: string; menge?: number; einzelpreis?: number }>;
};

export function UebernahmeAuftragChDialog({
  open, onOpenChange, documentId, defaultOrderNumber, defaultTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  defaultOrderNumber?: string;
  defaultTitle?: string;
}) {
  const nav = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [notes, setNotes] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [entities, setEntities] = useState<AiEntities | null>(null);
  const [ocrText, setOcrText] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setOrderNumber(defaultOrderNumber ?? '');
    setAmount('');
    setOrderDate('');
    setCurrency('CHF');
    setNotes('');
    setCustomerSearch('');
    setCustomers([]);
    setCustomer(null);
    setEntities(null);
    setOcrText('');
    // Auto: bestehende OCR/Entities laden — falls leer, direkt scannen
    (async () => {
      const { data } = await supabase
        .from('alixdocs2_documents')
        .select('ai_entities, ocr_text')
        .eq('id', documentId).maybeSingle();
      const ent = (data?.ai_entities as AiEntities) ?? null;
      const txt = (data?.ocr_text as string) ?? '';
      if (ent && Object.keys(ent).length > 0) {
        applyEntities(ent, txt);
      } else {
        await runScan();
      }
    })();
  }, [open, documentId, defaultOrderNumber]);

  function autoNumber() {
    const y = new Date().getFullYear();
    const rnd = Math.floor(10000 + Math.random() * 89999);
    return `${y}-CH-${rnd}`;
  }

  function applyEntities(ent: AiEntities, txt?: string) {
    setEntities(ent);
    if (txt !== undefined) setOcrText(txt);
    if (ent.auftrag_nr) setOrderNumber(ent.auftrag_nr);
    else if (!orderNumber) setOrderNumber(autoNumber());
    const amt = ent.betrag_brutto ?? ent.betrag_netto ?? null;
    if (amt != null) setAmount(String(amt));
    if (ent.waehrung) setCurrency(ent.waehrung);
    if (ent.datum) setOrderDate(ent.datum);
    const noteParts: string[] = [];
    if (ent.rechnung_nr) noteParts.push(`Rechnung: ${ent.rechnung_nr}`);
    if (ent.angebot_nr) noteParts.push(`Angebot: ${ent.angebot_nr}`);
    if (ent.serien_nr) noteParts.push(`Serien-Nr: ${ent.serien_nr}`);
    if (ent.adresse) noteParts.push(`Adresse: ${ent.adresse}`);
    if (ent.telefon) noteParts.push(`Tel: ${ent.telefon}`);
    if (ent.email) noteParts.push(`E-Mail: ${ent.email}`);
    if (Array.isArray(ent.positionen) && ent.positionen.length) {
      noteParts.push('Positionen:');
      for (const p of ent.positionen.slice(0, 20)) {
        noteParts.push(`  · ${p.menge ?? ''}× ${p.beschreibung ?? ''} @ ${p.einzelpreis ?? ''}`);
      }
    }
    if (noteParts.length) setNotes(noteParts.join('\n'));
    // Auto-Kundensuche
    const q = ent.kunde_nr || ent.email || ent.kunde_name;
    if (q) {
      setCustomerSearch(q);
      setTimeout(() => doSearch(q), 0);
    }
  }

  async function runScan() {
    setScanning(true);
    const { data, error } = await supabase.functions.invoke('alixdocs2-analyze', { body: { document_id: documentId } });
    if (error) {
      toast.error('OCR/Analyse fehlgeschlagen: ' + error.message);
      setScanning(false);
      return;
    }
    // Nachladen
    const { data: d2 } = await supabase
      .from('alixdocs2_documents')
      .select('ai_entities, ocr_text')
      .eq('id', documentId).maybeSingle();
    const ent = (d2?.ai_entities as AiEntities) ?? {};
    applyEntities(ent, (d2?.ocr_text as string) ?? '');
    toast.success('OCR abgeschlossen' + ((data as any)?.doc_type ? ` — ${(data as any).doc_type}` : ''));
    setScanning(false);
  }

  async function doSearch(termArg?: string) {
    const term = (termArg ?? customerSearch).trim();
    if (!term) return;
    setSearching(true);
    const q = `%${term}%`;
    const { data } = await supabase
      .from('customers')
      .select('id, company_name, contact_name, email')
      .or(`company_name.ilike.${q},contact_name.ilike.${q},email.ilike.${q}`)
      .limit(20);
    const list = (data as Customer[]) ?? [];
    setCustomers(list);
    if (list.length === 1) setCustomer(list[0]);
    setSearching(false);
  }

  async function submit() {
    if (!customer) { toast.error('Bitte Kunde auswählen'); return; }
    if (!orderNumber.trim()) { toast.error('Auftragsnummer fehlt'); return; }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;

    const { data: inserted, error } = await supabase
      .from('orders')
      .insert({
        customer_id: customer.id,
        order_number: orderNumber.trim(),
        source_system: 'zoho_eu_1',
        order_status: 'offen',
        currency: currency || 'CHF',
        total_amount: amount ? Number(amount) : null,
        order_date: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
        raw_data: {
          branch_id: CH_BRANCH_ID,
          created_from_alixdocs2: documentId,
          created_manually: true,
          title: defaultTitle ?? null,
          notes: notes || null,
          ai_entities: entities ?? null,
        },
      })
      .select('id')
      .single();

    if (error || !inserted) {
      setSaving(false);
      toast.error('Auftrag konnte nicht angelegt werden: ' + (error?.message ?? ''));
      return;
    }

    await supabase.from('alixdocs2_relations').insert({
      document_id: documentId,
      linked_type: 'order',
      linked_id: inserted.id,
      confidence: 1,
      source: 'manual_ch_uebernahme',
      created_by: uid ?? null,
    });

    setSaving(false);
    toast.success('CH-Auftrag angelegt: ' + orderNumber);
    onOpenChange(false);
    nav(`/auftraege/${inserted.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🇨🇭 Übernahme in Aufträge Schweiz
            {scanning && <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin"/>OCR läuft</Badge>}
            {entities && !scanning && <Badge variant="secondary" className="gap-1"><Sparkles className="w-3 h-3"/>KI-Daten übernommen</Badge>}
          </DialogTitle>
          <DialogDescription>
            OCR scannt das Dokument, extrahiert alle Auftragsdaten und übernimmt sie automatisch. Prüfen, Kunde wählen, anlegen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => runScan()} disabled={scanning}>
              {scanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Sparkles className="w-3 h-3 mr-1"/>}
              OCR erneut ausführen
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Auftragsnummer</Label>
              <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div>
              <Label>Betrag</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Währung</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>

          <div>
            <Label>Kunde suchen {entities?.kunde_name && <span className="text-xs text-muted-foreground">· KI: {entities.kunde_name}{entities.kunde_nr ? ` (${entities.kunde_nr})` : ''}</span>}</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Firma / Kontakt / E-Mail / Kunden-Nr…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              />
              <Button type="button" variant="outline" onClick={() => doSearch()} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {customers.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto border rounded divide-y">
                {customers.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCustomer(c)}
                    className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted flex items-center gap-2 ${
                      customer?.id === c.id ? 'bg-muted' : ''
                    }`}
                  >
                    {customer?.id === c.id && <Check className="w-3 h-3 text-primary" />}
                    <span className="flex-1 truncate">
                      {c.company_name ?? c.contact_name ?? '—'}
                      {c.customer_number ? <span className="text-muted-foreground"> · {c.customer_number}</span> : null}
                      {c.email ? <span className="text-muted-foreground"> · {c.email}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {customer && (
              <p className="text-xs mt-2 text-muted-foreground">
                Ausgewählt: <strong>{customer.company_name ?? customer.contact_name}</strong>
              </p>
            )}
          </div>

          <div>
            <Label>Notizen (OCR-Daten)</Label>
            <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} className="font-mono text-xs" />
          </div>

          {ocrText && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Roh-OCR anzeigen ({ocrText.length} Zeichen)</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap bg-muted p-2 rounded">{ocrText.slice(0, 5000)}</pre>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving || !customer || scanning}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Auftrag anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
