import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ClipboardCheck, Save, Loader2 } from 'lucide-react';
import { enqueue, flush } from '@/lib/mobile/outbox';
import { toast } from 'sonner';

interface Checklist { id: string; name: string; checklist_type: string; items: any[] }

export default function MobileChecklist() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lists, setLists] = useState<Checklist[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('dispatch_checklists').select('*').eq('is_active', true).order('name');
      setLists(((data as any) || []) as Checklist[]);
      setLoading(false);
    })();
  }, []);

  // localStorage Draft pro Einsatz+Checkliste
  const draftKey = selected && id ? `m_check_${id}_${selected}` : '';
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setAnswers(JSON.parse(raw));
    } catch { /* noop */ }
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try { localStorage.setItem(draftKey, JSON.stringify(answers)); } catch { /* noop */ }
  }, [answers, draftKey]);

  const current = lists.find(l => l.id === selected);

  const progress = useMemo(() => {
    if (!current?.items?.length) return 0;
    const filled = current.items.filter((it: any) => {
      const v = answers[it.id];
      return it.type === 'bool' ? v === true : (v !== undefined && String(v).trim() !== '');
    }).length;
    return Math.round((filled / current.items.length) * 100);
  }, [answers, current]);

  const save = async () => {
    if (!current || !id) return;
    setBusy(true);
    await enqueue({
      kind: 'checklist_run',
      payload: {
        route_plan_id: id,
        checklist_id: current.id,
        technician_user_id: user?.id,
        answers,
        completed_at: new Date().toISOString(),
      },
    });
    if (navigator.onLine) {
      const r = await flush();
      toast.success(`${r.ok} gespeichert`);
    } else toast.info('Offline – wird synchronisiert.');
    if (draftKey) localStorage.removeItem(draftKey);
    setAnswers({});
    setBusy(false);
  };

  return (
    <div className="p-4 space-y-4">
      <Link to={`/m/einsatz/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> zurück
      </Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Checkliste</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> lädt…</div>
      ) : (
        <Card className="p-4 space-y-3">
          <div>
            <Label>Vorlage</Label>
            <Select value={selected} onValueChange={(v) => { setSelected(v); setAnswers({}); }}>
              <SelectTrigger><SelectValue placeholder="Vorlage wählen" /></SelectTrigger>
              <SelectContent>
                {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {current && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fortschritt</span><span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-3 pt-1">
                {(current.items || []).map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <Label className="flex-1 text-sm">{it.label}</Label>
                    {it.type === 'bool' ? (
                      <Switch checked={!!answers[it.id]} onCheckedChange={(v) => setAnswers(a => ({ ...a, [it.id]: v }))} />
                    ) : (
                      <Input
                        value={answers[it.id] ?? ''}
                        onChange={(e) => setAnswers(a => ({ ...a, [it.id]: e.target.value }))}
                        className="max-w-[55%] h-9"
                      />
                    )}
                  </div>
                ))}
                <Button onClick={save} disabled={busy} className="w-full h-12 gold-gradient">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  Checkliste speichern
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
