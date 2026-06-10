import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Trash2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const LEVEL_LABEL = ['—', 'Zahlungserinnerung', '1. Mahnung', '2. Mahnung', 'Letzte Mahnung'];
const fmt = (n: number | null | undefined) => typeof n === 'number'
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : '–';

export default function FinanceMahnwesenDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [customer, setCustomer] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [itemsByReminder, setItemsByReminder] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = async () => {
    if (!customerId) return;
    setLoading(true);
    const [c, a, r] = await Promise.all([
      supabase.from('customers').select('id, company_name, contact_name, email, iban, bic, bank_name').eq('id', customerId).maybeSingle(),
      supabase.from('finance_accounts' as any).select('*').eq('customer_id', customerId).maybeSingle(),
      supabase.from('finance_reminders' as any).select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
    ]);
    setCustomer(c.data);
    setAccount(a.data);
    const rems = ((r.data ?? []) as any[]);
    setReminders(rems);
    if (rems.length) {
      const { data: items } = await supabase.from('finance_reminder_items' as any).select('*').in('reminder_id', rems.map(x => x.id));
      const grouped: Record<string, any[]> = {};
      ((items ?? []) as any[]).forEach((it: any) => {
        grouped[it.reminder_id] = grouped[it.reminder_id] || [];
        grouped[it.reminder_id].push(it);
      });
      setItemsByReminder(grouped);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [customerId]);

  const send = async (id: string) => {
    setSendingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('finance-reminder-send', { body: { reminder_id: id } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'Fehler beim Versand');
      toast({ title: 'Mahnung versendet', description: `An ${data.recipient}` });
      await load();
    } catch (e: any) {
      toast({ title: 'Versand fehlgeschlagen', description: e?.message ?? 'Unbekannt', variant: 'destructive' });
    } finally { setSendingId(null); }
  };

  const removeDraft = async (id: string) => {
    if (!confirm('Entwurf löschen?')) return;
    const { error } = await supabase.from('finance_reminders' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Entwurf gelöscht' });
    await load();
  };

  if (loading) return <PageLoading />;
  if (!customer) return <div className="p-6 text-muted-foreground">Kunde nicht gefunden.</div>;

  return (
    <div className="p-4 sm:p-6">
      <Link to="/finance/mahnwesen" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="w-4 h-4 mr-1" />Zurück zur Übersicht</Link>
      <PageHeader
        icon={<Mail className="w-6 h-6 text-primary" />}
        title={customer.company_name || customer.contact_name || 'Kunde'}
        subtitle={`E-Mail: ${customer.email ?? '–'} • Überfällig: ${fmt(account?.overdue_balance)} • Aktuelle Stufe: ${LEVEL_LABEL[account?.reminder_level ?? 0]}`}
      />

      <DataCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">Mahnungs-Historie</div>
        {reminders.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Noch keine Mahnungen vorhanden.</div>
        ) : (
          <div className="divide-y divide-border">
            {reminders.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{LEVEL_LABEL[r.level]}</Badge>
                    <Badge className={r.status === 'Versendet' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}>{r.status}</Badge>
                    <span className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</span>
                    {r.sent_at && <span className="text-sm text-muted-foreground">• gesendet {new Date(r.sent_at).toLocaleString('de-DE')}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">Betrag <strong>{fmt(r.amount)}</strong> + Gebühr {fmt(r.fee)} + Zinsen {fmt(r.interest)} = <strong>{fmt(r.total)}</strong></span>
                    {r.status === 'Entwurf' && (
                      <>
                        <Button size="sm" onClick={() => send(r.id)} disabled={sendingId === r.id || !customer.email} className="gold-gradient text-primary-foreground">
                          <Send className="w-3.5 h-3.5 mr-1" />{sendingId === r.id ? 'Senden…' : 'Versenden'}
                        </Button>
                        {isSuperAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => removeDraft(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {itemsByReminder[r.id]?.length ? (
                  <table className="w-full mt-3 text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left py-1">Rechnung</th><th className="text-left py-1">Fällig</th>
                        <th className="text-right py-1">Tage</th><th className="text-right py-1">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsByReminder[r.id].map((it: any) => (
                        <tr key={it.id} className="border-t border-border/60">
                          <td className="py-1">{it.invoice_number ?? '–'}</td>
                          <td className="py-1">{it.due_date ? new Date(it.due_date).toLocaleDateString('de-DE') : '–'}</td>
                          <td className="py-1 text-right">{it.days_overdue}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}
