import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Phone, PhoneOff, User, Building2, Ticket as TicketIcon, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CallRow = {
  id: string;
  direction: string;
  status: string;
  from_number: string | null;
  to_number: string | null;
  extension: string | null;
  contact_id: string | null;
  started_at: string;
};

type ContactInfo = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  customer_number?: string | null;
  recent_orders?: Array<{ id: string; order_number: string | null; total_amount: number | null; order_status: string | null }>;
};

/**
 * Global screen-pop: listens to ac_calls INSERTs with status='ringing'
 * and shows a floating card with contact/customer/orders context.
 * Mounted once inside AppLayout so it works on every internal page.
 */
export default function CallScreenPop() {
  const { user } = useAuth();
  const [call, setCall] = useState<CallRow | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const loadContext = useCallback(async (row: CallRow) => {
    const number = row.direction === 'inbound' ? row.from_number : row.to_number;
    if (!number) return;

    // 1) contact by id or phone
    let contactRow: any = null;
    if (row.contact_id) {
      const { data } = await supabase.from('ac_contacts').select('id, full_name, email, phone, customer_id').eq('id', row.contact_id).maybeSingle();
      contactRow = data;
    }
    if (!contactRow) {
      const digits = number.replace(/[^0-9+]/g, '');
      const { data } = await supabase
        .from('ac_contacts')
        .select('id, full_name, email, phone, customer_id')
        .or(`phone.ilike.%${digits.slice(-8)}%,whatsapp_number.ilike.%${digits.slice(-8)}%`)
        .limit(1)
        .maybeSingle();
      contactRow = data;
    }

    const info: ContactInfo = contactRow
      ? { ...contactRow }
      : { id: '', full_name: null, email: null, phone: number, customer_id: null };

    // 2) customer + recent orders
    if (info.customer_id) {
      const [{ data: cust }, { data: orders }] = await Promise.all([
        supabase.from('customers').select('company_name, contact_name, external_customer_id').eq('id', info.customer_id).maybeSingle(),
        supabase
          .from('orders')
          .select('id, order_number, total_amount, order_status')
          .eq('customer_id', info.customer_id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      info.customer_name = cust?.company_name ?? cust?.contact_name ?? null;
      info.customer_number = cust?.external_customer_id ?? null;
      info.recent_orders = (orders ?? []) as any;
    }

    setContact(info);
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('screenpop-ac-calls')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ac_calls', filter: 'status=eq.ringing' },
        (payload) => {
          const row = payload.new as CallRow;
          if (dismissedIds.has(row.id)) return;
          setCall(row);
          setContact(null);
          loadContext(row);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ac_calls' },
        (payload) => {
          const row = payload.new as CallRow;
          // auto-close when call moves past ringing
          setCall((prev) => (prev && prev.id === row.id && ['ended', 'missed', 'voicemail', 'answered'].includes(row.status) ? null : prev));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadContext, dismissedIds]);

  const dismiss = () => {
    if (call) setDismissedIds((s) => new Set(s).add(call.id));
    setCall(null);
    setContact(null);
  };

  if (!call) return null;

  const number = call.direction === 'inbound' ? call.from_number : call.to_number;
  const isInbound = call.direction === 'inbound';

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-96 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-yellow-500/60 bg-background shadow-2xl animate-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-yellow-500/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Phone className="h-5 w-5 text-yellow-500" />
            <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-yellow-500" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {isInbound ? 'Eingehender Anruf' : 'Ausgehender Anruf'}
            </div>
            <div className="font-mono text-sm font-semibold">{number ?? 'Unbekannt'}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Schließen">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 px-4 py-3 text-sm">
        {contact === null ? (
          <div className="text-muted-foreground">Kontext wird geladen …</div>
        ) : contact.id ? (
          <>
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{contact.full_name ?? 'Unbekannter Kontakt'}</div>
                {contact.email && <div className="text-xs text-muted-foreground">{contact.email}</div>}
              </div>
            </div>
            {contact.customer_id && (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{contact.customer_name ?? 'Kunde'}</div>
                  {contact.customer_number && (
                    <div className="text-xs text-muted-foreground">#{contact.customer_number}</div>
                  )}
                </div>
              </div>
            )}
            {contact.recent_orders && contact.recent_orders.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <TicketIcon className="h-3 w-3" /> Letzte Aufträge
                </div>
                <ul className="space-y-1">
                  {contact.recent_orders.slice(0, 3).map((o) => (
                    <li key={o.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1">
                      <Link to={`/verkauf/auftraege/${o.id}`} className="font-mono text-xs text-primary hover:underline" onClick={dismiss}>
                        {o.order_number ?? o.id.slice(0, 8)}
                      </Link>
                      <span className="text-xs text-muted-foreground">{o.status ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="rounded border border-dashed border-border/60 p-3 text-muted-foreground">
            Keine Kontaktzuordnung. Nummer <span className="font-mono">{number}</span> ist unbekannt.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2">
        <Link
          to="/connect/telefonie"
          onClick={dismiss}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Journal öffnen
        </Link>
        <Button size="sm" variant="destructive" onClick={dismiss}>
          <PhoneOff className="mr-1 h-3 w-3" /> Ausblenden
        </Button>
      </div>
    </div>
  );
}
