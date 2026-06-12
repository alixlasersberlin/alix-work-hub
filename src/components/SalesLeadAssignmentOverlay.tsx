import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, FilePlus, Mail, Phone, Building2, User as UserIcon, MapPin, MessageSquare } from 'lucide-react';

type Lead = {
  id: string;
  created_at: string;
  source: string;
  form_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  requested_products: string | null;
  message: string | null;
  lead_status: string;
  assigned_user: string | null;
  lead_score: number | null;
  score_category: string | null;
  converted_customer_id: string | null;
};

const ACK_KEY = 'sales_lead_assignment_ack_v1';

function loadAcked(): Set<string> {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function ack(id: string) {
  const s = loadAcked(); s.add(id);
  try { localStorage.setItem(ACK_KEY, JSON.stringify([...s])); } catch {}
}

export default function SalesLeadAssignmentOverlay() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [queue, setQueue] = useState<Lead[]>([]);

  const fetchLead = useCallback(async (id: string) => {
    const { data } = await supabase.from('sales_leads').select('*').eq('id', id).maybeSingle();
    if (!data) return;
    const acked = loadAcked();
    if (acked.has(data.id)) return;
    if (data.assigned_user !== user?.id) return;
    setQueue((q) => q.find(l => l.id === data.id) ? q : [...q, data as Lead]);
  }, [user?.id]);

  // Initial: lade alle aktuell zugewiesenen, noch nicht bestätigten Anfragen
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('sales_leads')
        .select('*')
        .eq('assigned_user', user.id)
        .not('lead_status', 'in', '("Gewonnen","Verloren","Archiviert","Angebot erstellt")')
        .order('created_at', { ascending: false })
        .limit(20);
      if (cancelled || !data) return;
      const acked = loadAcked();
      setQueue(data.filter((d: any) => !acked.has(d.id)) as Lead[]);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Realtime: neue Zuweisungen
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('sales_lead_assignment_overlay')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales_leads' }, (payload: any) => {
        const n = payload.new; const o = payload.old;
        if (n?.assigned_user === user.id && o?.assigned_user !== user.id) {
          fetchLead(n.id);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales_leads' }, (payload: any) => {
        const n = payload.new;
        if (n?.assigned_user === user.id) fetchLead(n.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchLead]);

  if (queue.length === 0) return null;
  const lead = queue[0];

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  const address = [lead.street, [lead.zip, lead.city].filter(Boolean).join(' '), lead.country].filter(Boolean).join(', ');

  const handleStartOffer = async () => {
    ack(lead.id);
    // Handoff in den bestehenden Angebots-Editor
    const handoff = {
      customer_id: lead.converted_customer_id,
      customer_email: lead.email,
      customer_company: lead.company,
      notes: [
        lead.requested_products && `Produktinteresse: ${lead.requested_products}`,
        lead.message,
      ].filter(Boolean).join('\n\n'),
      source: 'sales_lead',
      lead_id: lead.id,
    };
    try { sessionStorage.setItem('sales_lead_handoff_v1', JSON.stringify(handoff)); } catch {}
    await supabase.from('sales_leads').update({ lead_status: 'Angebot erstellt' }).eq('id', lead.id);
    setQueue((q) => q.filter(l => l.id !== lead.id));
    nav('/verkauf/angebot/neu');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
      <div className="w-full max-w-5xl rounded-3xl border-2 border-primary/50 bg-gradient-to-br from-background via-background to-primary/10 shadow-[0_0_80px_rgba(255,200,0,0.25)] overflow-hidden">
        <div className="flex items-center gap-4 px-8 py-6 border-b border-primary/30 bg-primary/10">
          <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Inbox className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-primary/80 font-semibold">Neue Vertriebsanfrage – Dir zugewiesen</div>
            <h2 className="text-3xl font-bold mt-1">{lead.company || fullName || 'Anfrage'}</h2>
          </div>
          {lead.lead_score != null && (
            <div className="text-right">
              <div className="text-4xl font-black text-primary">{lead.lead_score}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{lead.score_category || 'Score'}</div>
            </div>
          )}
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-base">
          <Row icon={<Building2 className="h-5 w-5" />} label="Firma" value={lead.company} />
          <Row icon={<UserIcon className="h-5 w-5" />} label="Ansprechpartner" value={fullName} />
          <Row icon={<Mail className="h-5 w-5" />} label="E-Mail" value={lead.email} link={lead.email ? `mailto:${lead.email}` : undefined} />
          <Row icon={<Phone className="h-5 w-5" />} label="Telefon" value={lead.phone} link={lead.phone ? `tel:${lead.phone}` : undefined} />
          <Row icon={<MapPin className="h-5 w-5" />} label="Adresse" value={address} />
          <Row icon={<Inbox className="h-5 w-5" />} label="Quelle" value={lead.form_name || lead.source} />
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
              <FilePlus className="h-4 w-4" /> Produktinteresse
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-lg font-medium">
              {lead.requested_products || '—'}
            </div>
          </div>
          {lead.message && (
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <MessageSquare className="h-4 w-4" /> Nachricht
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-4 whitespace-pre-wrap">
                {lead.message}
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-primary/30 bg-background/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Diese Anfrage wurde Dir gerade zugewiesen. Bitte erstelle ein Angebot, um fortzufahren.
            {queue.length > 1 && (
              <Badge variant="secondary" className="ml-3">+{queue.length - 1} weitere Anfrage{queue.length - 1 === 1 ? '' : 'n'}</Badge>
            )}
          </div>
          <Button size="lg" className="text-base px-8 py-6" onClick={handleStartOffer}>
            <FilePlus className="h-5 w-5 mr-2" /> Ich erstelle das Angebot
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string | null; link?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
        {icon} {label}
      </div>
      {link && value ? (
        <a href={link} className="text-lg font-medium text-primary hover:underline break-all">{value}</a>
      ) : (
        <div className="text-lg font-medium break-all">{value || '—'}</div>
      )}
    </div>
  );
}
