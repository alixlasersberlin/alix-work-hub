import { useEffect, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

export default function FinanceCollectPlaybooks() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('collect_playbooks' as any).select('*').order('priority', { ascending: true });
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await supabase.from('collect_playbooks' as any).update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const create = async () => {
    if (!code.trim() || !label.trim()) { toast({ title: 'Code und Bezeichnung nötig', variant: 'destructive' }); return; }
    const { error } = await supabase.from('collect_playbooks' as any).insert({ code: code.trim().toLowerCase(), label: label.trim(), priority: 100 });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setCode(''); setLabel('');
    toast({ title: 'Playbook angelegt' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Collections Playbooks" subtitle="Mahnstrategien je Kundentyp – Kulanz, Kanal, Eskalation und Mahnstopp" icon={BookOpen} />

      <DataCard title="Neues Playbook">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-48" placeholder="Code (z. B. haendler)" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input className="w-64" placeholder="Bezeichnung" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Anlegen</Button>
        </div>
      </DataCard>

      <DataCard title="Strategien">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={BookOpen} title="Keine Playbooks" description="Lege eine erste Mahnstrategie an." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Strategie</th>
                  <th className="py-2 pr-3">Prio</th>
                  <th className="py-2 pr-3">Kulanz (Tage)</th>
                  <th className="py-2 pr-3">Erstkanal</th>
                  <th className="py-2 pr-3">Sprache</th>
                  <th className="py-2 pr-3">Stopp b. Rekla</th>
                  <th className="py-2 pr-3">Leasing</th>
                  <th className="py-2 pr-3">Anruf</th>
                  <th className="py-2 pr-3">Raten</th>
                  <th className="py-2 pr-3">Eskalation</th>
                  <th className="py-2 pr-3">Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.code}{r.description ? ` · ${r.description}` : ''}</div>
                    </td>
                    <td className="py-2 pr-3"><Badge variant="outline">{r.priority}</Badge></td>
                    <td className="py-2 pr-3">
                      <Input className="h-8 w-20" defaultValue={String(r.grace_days ?? 0)}
                        onBlur={(e) => { const v = Number(e.target.value || 0); if (v !== r.grace_days) patch(r.id, { grace_days: v }); }} />
                    </td>
                    <td className="py-2 pr-3">
                      <Input className="h-8 w-28" defaultValue={r.first_channel ?? 'email'}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v !== r.first_channel) patch(r.id, { first_channel: v }); }} />
                    </td>
                    <td className="py-2 pr-3">
                      <Input className="h-8 w-16" defaultValue={r.language ?? 'de'}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v !== r.language) patch(r.id, { language: v }); }} />
                    </td>
                    <td className="py-2 pr-3"><Switch checked={!!r.pause_on_complaint} onCheckedChange={(v) => patch(r.id, { pause_on_complaint: v })} /></td>
                    <td className="py-2 pr-3"><Switch checked={!!r.notify_leasing} onCheckedChange={(v) => patch(r.id, { notify_leasing: v })} /></td>
                    <td className="py-2 pr-3"><Switch checked={!!r.personal_call} onCheckedChange={(v) => patch(r.id, { personal_call: v })} /></td>
                    <td className="py-2 pr-3"><Switch checked={!!r.watch_installments} onCheckedChange={(v) => patch(r.id, { watch_installments: v })} /></td>
                    <td className="py-2 pr-3">
                      <Input className="h-8 w-40" defaultValue={r.escalate_to ?? ''} placeholder="—"
                        onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (r.escalate_to ?? null)) patch(r.id, { escalate_to: v }); }} />
                    </td>
                    <td className="py-2 pr-3"><Switch checked={!!r.active} onCheckedChange={(v) => patch(r.id, { active: v })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
