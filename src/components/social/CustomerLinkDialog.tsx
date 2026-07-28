import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2Off, Search } from 'lucide-react';
import { toast } from 'sonner';

type Customer = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  source_system: string | null;
};

interface Props {
  clientId: string;
  currentCustomerId: string | null;
  onClose: () => void;
  onLinked: () => void;
}

export function CustomerLinkDialog({ clientId, currentCustomerId, onClose, onLinked }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Customer[]>([]);
  const [current, setCurrent] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!currentCustomerId) { setCurrent(null); return; }
    supabase.from('customers').select('id,company_name,contact_name,email,source_system').eq('id', currentCustomerId).maybeSingle()
      .then(({ data }) => setCurrent(data as Customer | null));
  }, [currentCustomerId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setRows([]); return; }
      const like = `%${term}%`;
      const { data } = await supabase
        .from('customers')
        .select('id,company_name,contact_name,email,source_system')
        .or(`company_name.ilike.${like},contact_name.ilike.${like},email.ilike.${like},external_customer_id.ilike.${like}`)
        .limit(25);
      setRows((data ?? []) as Customer[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function link(customerId: string | null) {
    setBusy(true);
    const { error } = await supabase.from('social_clients').update({ customer_id: customerId }).eq('id', clientId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(customerId ? 'Kunde verknüpft' : 'Verknüpfung entfernt');
    onLinked();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Alix-Kunde verknüpfen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {current && (
            <div className="border border-border rounded-lg p-3 flex items-center justify-between bg-muted/40">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Aktuell verknüpft</div>
                <div className="font-medium">{current.company_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{current.contact_name} · {current.email}</div>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => link(null)}>
                <Link2Off className="mr-2 h-4 w-4" />Trennen
              </Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma, Kontakt, E-Mail oder Kundennr. suchen…" className="pl-9" />
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border border border-border rounded-lg">
            {rows.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {q.trim().length < 2 ? 'Mindestens 2 Zeichen eingeben.' : 'Keine Treffer.'}
              </div>
            )}
            {rows.map((r) => (
              <button
                key={r.id}
                disabled={busy || r.id === currentCustomerId}
                onClick={() => link(r.id)}
                className="w-full text-left p-3 hover:bg-muted/60 disabled:opacity-50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.company_name ?? r.contact_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.contact_name} · {r.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.source_system && <Badge variant="secondary" className="text-[10px]">{r.source_system}</Badge>}
                  {r.id === currentCustomerId && <Badge>verknüpft</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
