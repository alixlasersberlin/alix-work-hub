import { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string };

const CONSENT_ACCEPT = 'Ich habe das vorliegende Angebot vollständig geprüft und nehme es hiermit rechtsverbindlich zu den genannten Konditionen an.';
const DECLINE_REASONS = [
  { v: 'preis', l: 'Preis' },
  { v: 'finanzierung', l: 'Finanzierung' },
  { v: 'lieferzeit', l: 'Lieferzeit' },
  { v: 'anderes_geraet', l: 'Anderes Gerät gewählt' },
  { v: 'kein_bedarf', l: 'Aktuell kein Bedarf' },
  { v: 'rueckruf', l: 'Rückruf gewünscht' },
  { v: 'sonstiges', l: 'Anderer Grund' },
];

export default function CustomerPortalOfferDetail() {
  const { id } = useParams();
  const ctx = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<any>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [declineReason, setDeclineReason] = useState('preis');
  const [declineNote, setDeclineNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('id', id)
        .eq('customer_id', ctx.customerId)
        .eq('customer_visible', true)
        .maybeSingle();
      setOffer(data);
      setLoading(false);
      if (data) void logPortalAudit({ action: 'invoice_opened', customerId: ctx.customerId, objectType: 'offer', objectId: id });
    })();
  }, [id, ctx.customerId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!offer) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Angebot nicht gefunden oder nicht mehr verfügbar.</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/kunde/angebote"><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Link></Button>
    </div>
  );

  const expired = offer.valid_until && new Date(offer.valid_until).getTime() < Date.now();
  const finalized = ['angenommen', 'abgelehnt', 'storniert'].includes(String(offer.status).toLowerCase());
  const canAct = !expired && !finalized;

  const submitAcceptance = async (action: 'accepted' | 'declined') => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('portal-offer-action', {
        body: {
          offer_id: offer.id,
          action,
          accepted_by_name: name.trim(),
          accepted_by_role: role.trim() || null,
          consent_text: action === 'accepted' ? CONSENT_ACCEPT : `Angebot abgelehnt. Grund: ${declineReason}`,
          decline_reason: action === 'declined' ? declineReason : null,
          decline_note: action === 'declined' ? declineNote.trim() || null : null,
        },
      });
      if (error) throw error;
      void logPortalAudit({
        action: action === 'accepted' ? 'offer_accepted' : 'offer_declined',
        customerId: ctx.customerId, objectType: 'offer', objectId: offer.id,
        metadata: { action, reason: declineReason },
      });
      toast.success(action === 'accepted' ? 'Angebot rechtsverbindlich angenommen.' : 'Angebot abgelehnt.');
      setAcceptOpen(false); setDeclineOpen(false);
      navigate('/kunde/angebote');
    } catch (e: any) {
      toast.error(e?.message ?? 'Aktion nicht möglich');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm"><Link to="/kunde/angebote"><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled title="PDF-Download folgt mit 2c">
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          {canAct && (
            <>
              <Button size="sm" onClick={() => setAcceptOpen(true)}><Check className="w-4 h-4 mr-1" />Annehmen</Button>
              <Button size="sm" variant="outline" onClick={() => setDeclineOpen(true)}><X className="w-4 h-4 mr-1" />Ablehnen</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Angebot {offer.offer_number}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Version {offer.portal_version ?? 1} · {offer.offer_date ? new Date(offer.offer_date).toLocaleDateString('de-DE') : '—'}
                {offer.valid_until && ` · gültig bis ${new Date(offer.valid_until).toLocaleDateString('de-DE')}`}
              </p>
            </div>
            <Badge variant={expired ? 'outline' : 'secondary'}>{expired ? 'abgelaufen' : offer.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Row k="Nettosumme" v={fmt(offer.total_net)} />
            <Row k="Umsatzsteuer" v={fmt(offer.total_tax)} />
            <Row k="Bruttosumme" v={fmt(offer.total_gross)} className="font-semibold" />
          </div>
          {offer.payload?.items && Array.isArray(offer.payload.items) && (
            <div>
              <p className="text-sm font-medium mb-2">Positionen</p>
              <div className="border border-border rounded-md divide-y divide-border">
                {offer.payload.items.map((it: any, i: number) => (
                  <div key={i} className="p-3 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0"><p className="font-medium truncate">{it.name ?? it.description}</p>
                      {it.description && it.name && <p className="text-xs text-muted-foreground line-clamp-2">{it.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p>{it.quantity ?? 1} × {fmt(it.unit_price ?? it.price)}</p>
                      <p className="text-xs text-muted-foreground">{fmt(it.total ?? (it.quantity ?? 1) * (it.unit_price ?? it.price ?? 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annahme */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Angebot annehmen</DialogTitle>
            <DialogDescription>
              Bitte prüfen Sie das Angebot vollständig. Ihre Zustimmung wird rechtsverbindlich protokolliert (Version {offer.portal_version ?? 1}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
              <span>{CONSENT_ACCEPT}</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Vor- und Nachname *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann" /></div>
              <div><Label>Funktion (optional)</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Geschäftsführung" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Zeitstempel, IP und Browserdaten werden mit protokolliert.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcceptOpen(false)} disabled={busy}>Abbrechen</Button>
            <Button disabled={!consent || !name.trim() || busy} onClick={() => submitAcceptance('accepted')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Verbindlich annehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ablehnung */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Angebot ablehnen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Grund</Label>
              <Select value={declineReason} onValueChange={setDeclineReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DECLINE_REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nachricht (optional)</Label><Textarea value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} maxLength={500} /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Vor- und Nachname *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Funktion (optional)</Label><Input value={role} onChange={(e) => setRole(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)} disabled={busy}>Abbrechen</Button>
            <Button variant="outline" disabled={!name.trim() || busy} onClick={() => submitAcceptance('declined')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v, className }: { k: string; v: string; className?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className={`text-sm mt-1 ${className ?? ''}`}>{v}</p>
    </div>
  );
}
function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
