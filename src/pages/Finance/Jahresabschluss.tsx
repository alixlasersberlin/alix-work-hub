import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Lock, Unlock, Plus } from 'lucide-react';
import { toast } from 'sonner';

type Run = {
  id: string;
  fiscal_year: number;
  status: string;
  closing_date: string | null;
  closed_at: string | null;
  notes: string | null;
  checklist: Record<string, boolean>;
};

const CHECKLIST_ITEMS = [
  { key: 'afa', label: 'AfA-Lauf für alle Monate abgeschlossen' },
  { key: 'eingangsrechnungen', label: 'Alle Eingangsrechnungen erfasst' },
  { key: 'opos', label: 'OPOS / Offene Posten geprüft' },
  { key: 'ust', label: 'USt-Voranmeldungen vollständig' },
  { key: 'bank', label: 'Bank vollständig abgestimmt' },
  { key: 'inventur', label: 'Inventur durchgeführt' },
  { key: 'anlagenspiegel', label: 'Anlagenspiegel überprüft' },
  { key: 'datev', label: 'DATEV-Export erstellt' },
];

export default function FinanceJahresabschluss() {
  const { isSuperAdmin } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('finance_year_end_runs' as any).select('*').order('fiscal_year', { ascending: false });
    const list = (data ?? []) as any as Run[];
    setRuns(list);
    if (list.length && !selected) setSelected(list[0]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createRun() {
    if (runs.find(r => r.fiscal_year === newYear)) {
      toast.error('Geschäftsjahr existiert bereits');
      return;
    }
    const { error } = await supabase.from('finance_year_end_runs' as any).insert({ fiscal_year: newYear, status: 'in_arbeit', checklist: {} });
    if (error) return toast.error(error.message);
    toast.success(`Geschäftsjahr ${newYear} angelegt`);
    load();
  }

  async function toggleCheck(key: string) {
    if (!selected) return;
    const next = { ...(selected.checklist || {}), [key]: !selected.checklist?.[key] };
    const { error } = await supabase.from('finance_year_end_runs' as any).update({ checklist: next }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    setSelected({ ...selected, checklist: next });
    setRuns(runs.map(r => r.id === selected.id ? { ...r, checklist: next } : r));
  }

  async function saveNotes(notes: string) {
    if (!selected) return;
    await supabase.from('finance_year_end_runs' as any).update({ notes }).eq('id', selected.id);
    setSelected({ ...selected, notes });
  }

  async function closeYear() {
    if (!selected) return;
    if (!confirm(`Geschäftsjahr ${selected.fiscal_year} wirklich abschließen? Buchungen werden danach für alle außer Super Admin gesperrt.`)) return;
    const { error } = await supabase.from('finance_year_end_runs' as any).update({
      status: 'abgeschlossen',
      closing_date: `${selected.fiscal_year}-12-31`,
      closed_at: new Date().toISOString(),
    }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success('Geschäftsjahr abgeschlossen');
    load();
  }

  async function reopenYear() {
    if (!selected) return;
    if (!isSuperAdmin) return toast.error('Nur Super Admin');
    if (!confirm(`Geschäftsjahr ${selected.fiscal_year} wieder eröffnen?`)) return;
    const { error } = await supabase.from('finance_year_end_runs' as any).update({
      status: 'in_arbeit',
      closing_date: null,
      reopened_at: new Date().toISOString(),
    }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success('Geschäftsjahr wiedereröffnet');
    load();
  }

  if (loading) return <PageLoading />;

  const done = selected ? CHECKLIST_ITEMS.filter(i => selected.checklist?.[i.key]).length : 0;
  const isClosed = selected?.status === 'abgeschlossen';

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Jahresabschluss-Cockpit" subtitle="Vorbereitung und Sperrung des Geschäftsjahres" />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Neues Geschäftsjahr</label>
          <Input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))} className="w-32" />
        </div>
        <Button onClick={createRun}><Plus className="h-4 w-4 mr-2" />Anlegen</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <DataCard title="Geschäftsjahre">
          <div className="space-y-1">
            {runs.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between ${selected?.id === r.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}
              >
                <span className="font-medium">{r.fiscal_year}</span>
                <Badge variant={r.status === 'abgeschlossen' ? 'default' : 'secondary'}>
                  {r.status === 'abgeschlossen' ? <Lock className="h-3 w-3 mr-1" /> : null}
                  {r.status}
                </Badge>
              </button>
            ))}
            {!runs.length && <div className="text-sm text-muted-foreground p-3">Noch kein Geschäftsjahr angelegt.</div>}
          </div>
        </DataCard>

        {selected && (
          <div className="space-y-6">
            <DataCard title={`Checkliste ${selected.fiscal_year} (${done}/${CHECKLIST_ITEMS.length})`}>
              <div className="space-y-2">
                {CHECKLIST_ITEMS.map(item => {
                  const checked = !!selected.checklist?.[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => !isClosed && toggleCheck(item.key)}
                      disabled={isClosed}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md border ${checked ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30 border-border'} ${isClosed ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted'}`}
                    >
                      {checked ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-muted-foreground" />}
                      <span className="text-sm">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </DataCard>

            <DataCard title="Notizen">
              <Textarea
                defaultValue={selected.notes || ''}
                onBlur={e => saveNotes(e.target.value)}
                disabled={isClosed}
                rows={4}
                placeholder="Hinweise für den Steuerberater, offene Punkte..."
              />
            </DataCard>

            <DataCard title="Abschluss">
              {isClosed ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4" />
                    Abgeschlossen am {selected.closed_at ? new Date(selected.closed_at).toLocaleString('de-DE') : '–'}
                    {' '}(Stichtag {selected.closing_date})
                  </div>
                  {isSuperAdmin && (
                    <Button variant="outline" onClick={reopenYear}>
                      <Unlock className="h-4 w-4 mr-2" />Geschäftsjahr wiedereröffnen (Super Admin)
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Nach Abschluss werden Buchungen in diesem Geschäftsjahr für alle Benutzer (außer Super Admin) gesperrt.
                  </p>
                  <Button onClick={closeYear} disabled={done < CHECKLIST_ITEMS.length}>
                    <Lock className="h-4 w-4 mr-2" />Geschäftsjahr abschließen
                  </Button>
                  {done < CHECKLIST_ITEMS.length && (
                    <div className="text-xs text-amber-500">Bitte zuerst alle Checklisten-Punkte abhaken.</div>
                  )}
                </div>
              )}
            </DataCard>
          </div>
        )}
      </div>
    </div>
  );
}
