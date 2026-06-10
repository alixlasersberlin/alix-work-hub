import { useEffect, useState } from 'react';
import { Loader2, Save, Lock, Unlock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { getFinanceAccount, createFinanceAccount, updateFinanceAccount } from '@/lib/finance/api';
import { toast } from 'sonner';

export default function FinanceAccountTab({ customerId }: { customerId: string }) {
  const { canRead, canWrite } = useFinancePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acc, setAcc] = useState<any>(null);

  useEffect(() => {
    if (!canRead) { setLoading(false); return; }
    (async () => {
      try {
        const a = await getFinanceAccount(customerId);
        setAcc(a);
      } catch (e: any) { toast.error(e.message); }
      setLoading(false);
    })();
  }, [customerId, canRead]);

  async function handleCreate() {
    try {
      setSaving(true);
      const a = await createFinanceAccount({ customer_id: customerId });
      setAcc(a);
      toast.success('Finanzakte angelegt');
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  async function handleSave() {
    if (!acc?.id) return;
    try {
      setSaving(true);
      const updated = await updateFinanceAccount(acc.id, {
        debtor_number: acc.debtor_number,
        payment_terms: acc.payment_terms,
        credit_limit: acc.credit_limit,
        reminder_level: acc.reminder_level,
        blocked: acc.blocked,
        notes: acc.notes,
      });
      setAcc(updated);
      toast.success('Gespeichert');
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  if (!canRead) return <div className="p-6 text-sm text-muted-foreground">Keine Berechtigung für die Finanzakte.</div>;
  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!acc) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-border bg-card/50 text-center">
        <p className="text-muted-foreground mb-4">Für diesen Kunden existiert noch keine Finanzakte.</p>
        {canWrite && (
          <Button onClick={handleCreate} disabled={saving} className="gold-gradient text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Finanzakte anlegen
          </Button>
        )}
      </div>
    );
  }

  const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const set = (k: string, v: any) => setAcc({ ...acc, [k]: v });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Offener Saldo</p>
          <p className="text-xl font-display font-bold">{fmt(acc.current_balance)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Überfällig</p>
          <p className={`text-xl font-display font-bold ${Number(acc.overdue_balance) > 0 ? 'text-destructive' : 'text-foreground'}`}>{fmt(acc.overdue_balance)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mahnstufe</p>
          <p className="text-xl font-display font-bold">{acc.reminder_level ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Debitorennummer</Label>
          <Input value={acc.debtor_number ?? ''} onChange={e => set('debtor_number', e.target.value)} disabled={!canWrite} />
        </div>
        <div className="space-y-1.5">
          <Label>Zahlungsbedingungen</Label>
          <Input value={acc.payment_terms ?? ''} onChange={e => set('payment_terms', e.target.value)} disabled={!canWrite} placeholder="z. B. 14 Tage netto" />
        </div>
        <div className="space-y-1.5">
          <Label>Kreditlimit (€)</Label>
          <Input type="number" step="0.01" value={acc.credit_limit ?? 0} onChange={e => set('credit_limit', e.target.value)} disabled={!canWrite} />
        </div>
        <div className="space-y-1.5">
          <Label>Mahnstufe</Label>
          <Input type="number" min={0} max={9} value={acc.reminder_level ?? 0} onChange={e => set('reminder_level', e.target.value)} disabled={!canWrite} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 sm:col-span-2">
          <div className="flex items-center gap-2">
            {acc.blocked ? <Lock className="w-4 h-4 text-destructive" /> : <Unlock className="w-4 h-4 text-success" />}
            <span className="font-medium">Kunde gesperrt</span>
          </div>
          <Switch checked={!!acc.blocked} onCheckedChange={(v) => set('blocked', v)} disabled={!canWrite} />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Notizen</Label>
          <Textarea rows={3} value={acc.notes ?? ''} onChange={e => set('notes', e.target.value)} disabled={!canWrite} />
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>Letzte Zahlung: {acc.last_payment_at ? new Date(acc.last_payment_at).toLocaleString('de-DE') : '—'}</span>
        <span>·</span>
        <span>Letzte Mahnung: {acc.last_reminder_at ? new Date(acc.last_reminder_at).toLocaleString('de-DE') : '—'}</span>
      </div>

      {canWrite && (
        <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Speichern
        </Button>
      )}
    </div>
  );
}
