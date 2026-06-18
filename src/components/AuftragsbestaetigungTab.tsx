import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Send, ExternalLink, Inbox } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orderId: string;
  customerId: string | null;
  customerEmail?: string | null;
}

type SigRow = {
  id: string;
  sign_request_id: string;
  signer_name: string | null;
  signer_email: string | null;
  offer_number: string | null;
  created_at: string;
  alix_sign_requests?: { token: string; offer_number: string | null; customer_name: string | null; signed_at: string | null } | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function AuftragsbestaetigungTab({ orderId, customerId, customerEmail }: Props) {
  const [loading, setLoading] = useState(true);
  const [sigs, setSigs] = useState<SigRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string>(customerEmail || '');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!customerId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('alix_sign_signatures')
        .select('id, sign_request_id, signer_name, signer_email, offer_number, created_at, alix_sign_requests!inner(token, offer_number, customer_name, signed_at, customer_id)')
        .eq('alix_sign_requests.customer_id', customerId)
        .order('created_at', { ascending: false });
      const rows = (data || []) as any as SigRow[];
      setSigs(rows);
      if (rows.length > 0) setSelectedId(rows[0].id);
      setLoading(false);
    })();
  }, [customerId]);

  const selected = sigs.find(s => s.id === selectedId) || null;
  const token = (selected?.alix_sign_requests as any)?.token as string | undefined;
  const previewUrl = selected && token
    ? `${SUPABASE_URL}/functions/v1/order-confirmation-pdf?signature_id=${selected.id}&token=${encodeURIComponent(token)}`
    : null;

  const handleSend = async () => {
    if (!selected) return;
    if (!recipient) { toast.error('Bitte E-Mail-Adresse angeben'); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-order-confirmation', {
        body: { signature_id: selected.id, order_id: orderId, recipient_email: recipient },
      });
      if (error) throw error;
      const failed = (data?.results || []).filter((r: any) => r.status !== 'sent');
      if (failed.length > 0) {
        toast.error(`Versand teilweise fehlgeschlagen: ${failed.map((f: any) => f.to).join(', ')}`);
      } else {
        toast.success('Auftragsbestätigung versendet');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Versand fehlgeschlagen');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 card-glow flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-6">
      <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" /> Auftragsbestätigung
      </h2>

      {sigs.length === 0 ? (
        <div className="text-center py-10">
          <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-muted-foreground">Kein unterzeichnetes Angebot für diesen Kunden gefunden.</p>
          <p className="text-xs text-muted-foreground mt-1">Sobald ein Angebot über Alix Sign unterzeichnet wurde, erscheint es hier.</p>
        </div>
      ) : (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">Unterzeichnetes Angebot auswählen</Label>
            <div className="mt-2 grid gap-2">
              {sigs.map(s => {
                const r = (s.alix_sign_requests as any) || {};
                const active = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                      active ? 'border-primary bg-primary/5' : 'border-border bg-secondary hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium text-foreground">{r.offer_number || s.offer_number || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          Unterzeichnet von {s.signer_name || '—'} · {r.signed_at ? new Date(r.signed_at).toLocaleString('de-DE') : new Date(s.created_at).toLocaleString('de-DE')}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{s.signer_email}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selected && previewUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Vorschau (mit „Auftragsbestätigung"-Kopfzeile)</Label>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  In neuem Tab öffnen <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <iframe
                key={previewUrl}
                src={previewUrl}
                className="w-full h-[640px] rounded-lg border border-border bg-white"
                title="Auftragsbestätigung Vorschau"
              />
            </div>
          )}

          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end pt-2 border-t border-border">
            <div>
              <Label className="text-xs text-muted-foreground">Empfänger E-Mail</Label>
              <Input
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="kunde@beispiel.de"
                className="bg-secondary border-border mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                BCC: rde@alix-lasers.com sowie Ersteller des Angebots
              </p>
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || !selected || !recipient}
              className="gold-gradient text-primary-foreground"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Als Auftragsbestätigung senden
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
