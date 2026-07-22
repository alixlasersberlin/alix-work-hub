import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CH_BRANCH_ID = '598077000000065075';

type Customer = { id: string; company_name?: string | null; contact_name?: string | null; email?: string | null };

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
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setOrderNumber(defaultOrderNumber ?? autoNumber());
      setAmount('');
      setCustomerSearch('');
      setCustomers([]);
      setCustomer(null);
    }
  }, [open, defaultOrderNumber]);

  function autoNumber() {
    const y = new Date().getFullYear();
    const rnd = Math.floor(10000 + Math.random() * 89999);
    return `${y}-CH-${rnd}`;
  }

  async function doSearch() {
    if (!customerSearch.trim()) return;
    setSearching(true);
    const q = `%${customerSearch.trim()}%`;
    const { data } = await supabase
      .from('customers')
      .select('id, company_name, contact_name, email')
      .or(`company_name.ilike.${q},contact_name.ilike.${q},email.ilike.${q}`)
      .limit(20);
    setCustomers((data as Customer[]) ?? []);
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
        currency: 'CHF',
        total_amount: amount ? Number(amount) : null,
        order_date: new Date().toISOString(),
        raw_data: {
          branch_id: CH_BRANCH_ID,
          created_from_alixdocs2: documentId,
          created_manually: true,
          title: defaultTitle ?? null,
        },
      })
      .select('id')
      .single();

    if (error || !inserted) {
      setSaving(false);
      toast.error('Auftrag konnte nicht angelegt werden: ' + (error?.message ?? ''));
      return;
    }

    // Link document → order
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🇨🇭 Übernahme in Aufträge Schweiz</DialogTitle>
          <DialogDescription>
            Erstellt einen neuen Auftrag in <strong>Verkauf → Aufträge → Aufträge CH</strong> und
            verknüpft dieses Dokument mit dem Auftrag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Auftragsnummer</Label>
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </div>
          <div>
            <Label>Betrag (CHF, optional)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div>
            <Label>Kunde suchen</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Firma / Kontakt / E-Mail…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              />
              <Button type="button" variant="outline" onClick={doSearch} disabled={searching}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving || !customer}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Auftrag anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
