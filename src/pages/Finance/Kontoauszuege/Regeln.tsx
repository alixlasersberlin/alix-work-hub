import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, Settings2, Brain, RefreshCw, Undo2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loadReturnRules, saveReturnRules, type ReturnRules } from '@/lib/bank/returnDebit';
import { listMatchRules, deleteMatchRule, setRuleAutoBook, type BankMatchRule } from '@/lib/bank/rules';
import { supabase } from '@/integrations/supabase/client';
import { listBankAccounts, type BankAccount } from '@/lib/bank/api';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import ReturnDunningTemplateCard from '@/components/bank/ReturnDunningTemplateCard';
import ReturnDunningEscalationCard from '@/components/bank/ReturnDunningEscalationCard';

export default function Importregeln() {
  const { region } = useAccountingRegion();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const accs = await listBankAccounts(region);
    setAccounts(accs);
    const ids = accs.map(a => a.id);
    if (!ids.length) { setRows([]); return; }
    const { data, error } = await supabase.from('bank_import_templates' as any)
      .select('*').in('bank_account_id', ids).order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setRows((data ?? []) as any[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const remove = async (id: string) => {
    if (!window.confirm('Importvorlage wirklich löschen?')) return;
    const { error } = await supabase.from('bank_import_templates' as any).delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Vorlage gelöscht'); load(); }
  };

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" />Importregeln &amp; Spaltenvorlagen</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Vorlagen entstehen im Importassistenten über „Als Importvorlage speichern“ und werden beim nächsten Import desselben Bankformats automatisch vorgeschlagen.
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-2">Vorlage</th><th className="p-2">Bankkonto</th><th className="p-2">Format</th>
            <th className="p-2">Zugeordnete Spalten</th><th className="p-2"></th>
          </tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Keine Importvorlagen vorhanden.</td></tr>}
            {rows.map(r => {
              const acc = accounts.find(a => a.id === r.bank_account_id);
              const map = r.column_mapping ?? {};
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-medium">{r.template_name}</td>
                  <td className="p-2">{acc ? `${acc.bank_name} · ${acc.account_name}` : '–'}</td>
                  <td className="p-2"><Badge variant="outline">{String(r.file_format ?? '').toUpperCase()}</Badge></td>
                  <td className="p-2 space-x-1">
                    {Object.entries(map).map(([k, v]) => <Badge key={k} variant="outline" className="mr-1">{k} → {String(v)}</Badge>)}
                  </td>
                  <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
    <LearnedRules region={region} />
    <AutoReconcileCard region={region} />
    <ReturnDebitRulesCard />
    <ReturnDunningEscalationCard />

    <ReturnDunningTemplateCard />
    </div>
  );
}

function ReturnDebitRulesCard() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [rules, setRules] = useState<ReturnRules | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadReturnRules().then(setRules).catch(() => {}); }, []);
  if (!rules) return null;

  const set = (patch: Partial<ReturnRules>) => setRules({ ...rules, ...patch });
  const save = async () => {
    setBusy(true);
    try { await saveReturnRules(rules); toast.success('Rücklastschriftregeln gespeichert'); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Check = ({ k, l }: { k: keyof ReturnRules; l: string }) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" disabled={!isSuperAdmin} checked={!!rules[k]} onChange={e => set({ [k]: e.target.checked } as any)} />{l}
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Undo2 className="w-4 h-4 text-red-500" />Regeln für Rücklastschriften</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Steuert Warnungen, Lastschriftsperren und Standardgebühren bei wiederholten Zahlungsstörungen. Änderungen sind nur für Super Admins möglich.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Erste Rücklastschrift</div>
            <Check k="firstWarn" l="Warnhinweis anzeigen, Forderung wieder öffnen, Buchhaltungsaufgabe erstellen" />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Zweite Rücklastschrift</div>
            <Check k="secondBlock" l="Lastschrift automatisch sperren" />
            <Check k="secondNotifyAdmin" l="Admin informieren" />
            <Check k="secondBlockDelivery" l="Lieferung / weitere Leistung sperren" />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Dritte Rücklastschrift</div>
            <Check k="thirdRisk" l="Kunde als erhöhtes Zahlungsrisiko markieren" />
            <Check k="thirdNotifySuperadmin" l="Superadmin informieren" />
            <Check k="thirdNoAutoDebit" l="Keine weitere automatische Lastschrift" />
            <Check k="thirdApprovalRequired" l="Neue Aufträge nur nach Freigabe (Vorkasse empfohlen)" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Standard-Bankgebühr</label>
            <input type="number" step="0.01" disabled={!isSuperAdmin} value={rules.defaultBankFee}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
              onChange={e => set({ defaultBankFee: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Standard-Gebühr für Kunden</label>
            <input type="number" step="0.01" disabled={!isSuperAdmin} value={rules.defaultCustomerFee}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
              onChange={e => set({ defaultCustomerFee: Number(e.target.value) })} />
          </div>
          <div className="flex items-end"><Check k="chargeCustomerByDefault" l="Gebühr standardmäßig weiterberechnen" /></div>
        </div>
        {isSuperAdmin && <Button size="sm" onClick={save} disabled={busy}>Regeln speichern</Button>}
      </CardContent>
    </Card>
  );
}

function AutoReconcileCard({ region }: { region: 'EU' | 'CH' }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('bank-auto-reconcile', { body: { area: region } });
      if (error) throw error;
      const s = (data as any)?.summary?.[0];
      setResult(s ? `${s.geprueft} Buchungen geprüft · ${s.vorschlaege} Vorschläge · ${s.verbucht} automatisch verbucht` : 'Abgleich abgeschlossen');
      toast.success('Abgleich abgeschlossen');
    } catch (e: any) {
      toast.error(e?.message ?? 'Abgleich fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4" />Automatischer Tagesabgleich</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Läuft täglich um 05:10 Uhr für EU und CH: offene Bankbuchungen werden gegen offene Rechnungen bewertet und als Vorschlag hinterlegt.
          Automatisch verbucht wird nur bei exaktem Betrag und einem Score oberhalb der Schwelle des Bankkontos bzw. einer gelernten Auto-Regel.
        </p>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Button size="sm" onClick={run} disabled={busy}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${busy ? 'animate-spin' : ''}`} />
          Jetzt für {region} abgleichen
        </Button>
        {result && <span className="text-xs text-muted-foreground">{result}</span>}
      </CardContent>
    </Card>
  );
}


function LearnedRules({ region }: { region: 'EU' | 'CH' }) {
  const [rules, setRules] = useState<BankMatchRule[]>([]);

  const load = async () => {
    try { setRules(await listMatchRules(region)); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const remove = async (id: string) => {
    if (!window.confirm('Gelernte Regel wirklich löschen?')) return;
    try { await deleteMatchRule(id); toast.success('Regel gelöscht'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (r: BankMatchRule) => {
    try { await setRuleAutoBook(r.id, !r.auto_book); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4" />Gelernte Zuordnungen</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Bei jeder Verbuchung merkt sich das System, welchem Kunden ein Zahler (IBAN bzw. Name) zugeordnet wurde. Beim nächsten Import erhöht das die Trefferquote automatisch.
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-2">Zahler</th><th className="p-2">IBAN</th><th className="p-2">Kunde</th>
            <th className="p-2">Art</th><th className="p-2">Treffer</th><th className="p-2">Zuletzt</th>
            <th className="p-2">Auto-Verbuchen</th><th className="p-2"></th>
          </tr></thead>
          <tbody>
            {!rules.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Noch keine gelernten Zuordnungen.</td></tr>}
            {rules.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 font-medium">{r.payer_name || '–'}</td>
                <td className="p-2 font-mono">{r.payer_iban || '–'}</td>
                <td className="p-2">{r.customer_name || r.customer_id || '–'}</td>
                <td className="p-2"><Badge variant="outline">{r.allocation_type}</Badge></td>
                <td className="p-2">{r.hit_count}</td>
                <td className="p-2">{r.last_used_at ? new Date(r.last_used_at).toLocaleDateString('de-DE') : '–'}</td>
                <td className="p-2">
                  <Button size="sm" variant={r.auto_book ? 'default' : 'outline'} onClick={() => toggle(r)}>
                    {r.auto_book ? 'aktiv' : 'aus'}
                  </Button>
                </td>
                <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
