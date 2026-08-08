import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { useAuth } from '@/hooks/useAuth';

const CHANNELS = ['email', 'pdf', 'sms', 'whatsapp', 'letter', 'phone'] as const;
const AMPEL = ['gruen', 'gelb', 'orange', 'rot', 'schwarz'] as const;
const AMPEL_LABEL: Record<string, string> = {
  gruen: 'Grün', gelb: 'Gelb', orange: 'Orange', rot: 'Rot', schwarz: 'Schwarz',
};
const BLOCKS = ['lieferung', 'ersatzteile', 'schulung', 'garantie', 'verlaengerung'] as const;

export default function FinanceCollectSettings() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('collect_stage_config' as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('day_offset', { ascending: true });
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = async (id: string, values: Record<string, any>) => {
    if (!canEdit) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...values } : r)));
    const { error } = await supabase
      .from('collect_stage_config' as any)
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); load(); }
  };

  const create = async () => {
    const maxSort = rows.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0);
    const { error } = await supabase.from('collect_stage_config' as any).insert({
      code: `stufe_${Date.now().toString().slice(-6)}`,
      label: 'Neue Stufe',
      day_offset: 0,
      sort_order: maxSort + 1,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!roles.includes('Super Admin')) { toast({ title: 'Nur Super Admin darf löschen', variant: 'destructive' }); return; }
    const { error } = await supabase.from('collect_stage_config' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const toggleArray = (r: any, key: string, value: string) => {
    const cur: string[] = Array.isArray(r[key]) ? r[key] : [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    patch(r.id, { [key]: next });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mahnstufen-Konfiguration"
        subtitle="Zeitpunkte, Kanäle, Gebühren, Zinsen, Sperren und Vorlagen der ALIX COLLECT Engine"
        icon={SettingsIcon}
      />

      {canEdit && (
        <DataCard title="Stufe hinzufügen">
          <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Neue Stufe</Button>
        </DataCard>
      )}

      <DataCard title="Stufen">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={SettingsIcon} title="Keine Stufen konfiguriert" description="Lege die Mahnstufen der Engine an." />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="h-8 w-52"
                    defaultValue={r.label ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value !== r.label && patch(r.id, { label: e.target.value })}
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Tag
                    <Input
                      className="h-8 w-20"
                      type="number"
                      defaultValue={String(r.day_offset ?? 0)}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        const v = Number(e.target.value || 0);
                        if (v !== Number(r.day_offset ?? 0)) patch(r.id, { day_offset: v });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Gebühr
                    <Input
                      className="h-8 w-20"
                      defaultValue={String(r.fee_amount ?? 0)}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        const v = Number(e.target.value || 0);
                        if (v !== Number(r.fee_amount ?? 0)) patch(r.id, { fee_amount: v });
                      }}
                    />€
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Zins
                    <Input
                      className="h-8 w-20"
                      defaultValue={String(r.interest_rate_pct ?? 0)}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        const v = Number(e.target.value || 0);
                        if (v !== Number(r.interest_rate_pct ?? 0)) patch(r.id, { interest_rate_pct: v });
                      }}
                    />%
                  </div>
                  <div className="flex items-center gap-1">
                    {AMPEL.map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => patch(r.id, { ampel: a })}
                        className={`rounded px-2 py-1 text-xs transition ${r.ampel === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                      >
                        {AMPEL_LABEL[a]}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      Aktiv
                      <Switch checked={!!r.active} disabled={!canEdit} onCheckedChange={(v) => patch(r.id, { active: v })} />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                      {openId === r.id ? 'Weniger' : 'Details'}
                    </Button>
                    {roles.includes('Super Admin') && (
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {openId === r.id && (
                  <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Kanäle</div>
                      <div className="flex flex-wrap gap-2">
                        {CHANNELS.map((c) => {
                          const on = Array.isArray(r.channels) && r.channels.includes(c);
                          return (
                            <Badge
                              key={c}
                              variant={on ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => canEdit && toggleArray(r, 'channels', c)}
                            >
                              {c}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Sperren setzen</div>
                      <div className="flex flex-wrap gap-2">
                        {BLOCKS.map((b) => {
                          const on = Array.isArray(r.set_blocks) && r.set_blocks.includes(b);
                          return (
                            <Badge
                              key={b}
                              variant={on ? 'destructive' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => canEdit && toggleArray(r, 'set_blocks', b)}
                            >
                              {b}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {([
                        ['attach_pdf', 'PDF anhängen'],
                        ['pay_now_link', 'Zahl-Link'],
                        ['cc_management', 'GF in CC'],
                        ['create_call_task', 'Telefonaufgabe'],
                        ['notify_sales', 'Vertrieb informieren'],
                        ['decision_stage', 'Entscheidungsstufe'],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between rounded border border-border/50 px-3 py-2 text-sm">
                          <span>{label}</span>
                          <Switch checked={!!r[key]} disabled={!canEdit} onCheckedChange={(v) => patch(r.id, { [key]: v })} />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">E-Mail-Betreff</div>
                      <Input
                        defaultValue={r.email_subject ?? ''}
                        disabled={!canEdit}
                        onBlur={(e) => e.target.value !== (r.email_subject ?? '') && patch(r.id, { email_subject: e.target.value })}
                      />
                      <div className="text-xs text-muted-foreground">E-Mail-Text</div>
                      <Textarea
                        rows={6}
                        defaultValue={r.email_body ?? ''}
                        disabled={!canEdit}
                        onBlur={(e) => e.target.value !== (r.email_body ?? '') && patch(r.id, { email_body: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Platzhalter: {'{{kunde}}'}, {'{{betrag}}'}, {'{{faellig_seit}}'}, {'{{rechnungen}}'}, {'{{zahl_link}}'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}
