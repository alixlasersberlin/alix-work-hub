/**
 * ALIX AI – Admin & Qualität (Prompt 5).
 * Feature-Flags, Schwellenwerte, Nutzungs- und Qualitätskennzahlen.
 * Automatik-Optionen (Routing/Priorität) sind bewusst standardmäßig AUS.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AI_FLAG_KEYS, fetchAiFlags, setAiFlag, type AiFlags } from '@/lib/inbox/ai';

const LABELS: Record<string, string> = {
  ai_enabled: 'ALIX AI aktiviert',
  ai_classification_enabled: 'Klassifizierung',
  ai_reply_enabled: 'Antwortvorschläge',
  ai_summary_enabled: 'Zusammenfassungen',
  ai_device_detection_enabled: 'Geräteerkennung',
  ai_ticket_detection_enabled: 'Ticket-Erkennung',
  ai_translation_enabled: 'Übersetzung',
  ai_sales_enabled: 'Sales-Erkennung',
  ai_technical_triage_enabled: 'Technik-Triage',
  ai_auto_routing_enabled: 'Auto-Routing (Vorsicht)',
  ai_auto_priority_enabled: 'Priorität automatisch übernehmen (Vorsicht)',
};

type Stats = {
  analyses: number; today: number; failed: number; replies: number; summaries: number;
  accepted: number; corrected: number; rejected: number; avgConfidence: number | null;
};

export default function MobilAdminAlixAi() {
  const [flags, setFlags] = useState<AiFlags | null>(null);
  const [minConf, setMinConf] = useState('0.75');
  const [debounce, setDebounce] = useState('6');
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { data: rows } = await (supabase as any)
      .from('ai_classifications')
      .select('classification_type, status, confidence, created_at')
      .gte('created_at', since).limit(5000);
    const { data: fb } = await (supabase as any).from('ai_feedback').select('feedback_type').gte('created_at', since).limit(5000);
    const list = rows ?? [];
    const confs = list.map((r: any) => r.confidence).filter((c: any) => typeof c === 'number');
    setStats({
      analyses: list.length,
      today: list.filter((r: any) => new Date(r.created_at) >= startOfDay).length,
      failed: list.filter((r: any) => r.status === 'FAILED').length,
      replies: list.filter((r: any) => r.classification_type === 'REPLY').length,
      summaries: list.filter((r: any) => r.classification_type === 'SUMMARY').length,
      accepted: (fb ?? []).filter((f: any) => f.feedback_type === 'ACCEPTED').length,
      corrected: (fb ?? []).filter((f: any) => f.feedback_type === 'CORRECTED').length,
      rejected: (fb ?? []).filter((f: any) => ['REJECTED', 'NOT_HELPFUL'].includes(f.feedback_type)).length,
      avgConfidence: confs.length ? Math.round((confs.reduce((a: number, b: number) => a + b, 0) / confs.length) * 100) : null,
    });
  };

  useEffect(() => {
    fetchAiFlags().then(setFlags).catch(() => setFlags(null));
    (supabase as any).from('app_settings').select('key, value')
      .in('key', ['ai_min_confidence', 'ai_analysis_debounce_seconds'])
      .then(({ data }: any) => {
        for (const r of data ?? []) {
          if (r.key === 'ai_min_confidence') setMinConf(String(r.value));
          if (r.key === 'ai_analysis_debounce_seconds') setDebounce(String(r.value));
        }
      });
    loadStats();
  }, []);

  const toggle = async (key: keyof AiFlags, value: boolean) => {
    try {
      await setAiFlag(key, value ? 'true' : 'false');
      setFlags((f) => (f ? { ...f, [key]: value } : f));
      toast.success('Einstellung gespeichert.');
    } catch (e: any) {
      toast.error(e?.message || 'Speichern nicht möglich (nur Admin).');
    }
  };

  return (
    <div className="space-y-3 p-3">
      <h1 className="text-lg font-semibold">ALIX AI</h1>
      <p className="text-xs text-muted-foreground">
        Die KI erstellt ausschließlich Vorschläge. Es wird niemals automatisch eine Nachricht an Kunden gesendet.
      </p>

      <Card className="divide-y divide-border">
        {!flags && <Skeleton className="m-3 h-40" />}
        {flags && AI_FLAG_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm">{LABELS[k] ?? k}</span>
            <Switch checked={flags[k]} onCheckedChange={(v) => toggle(k, v)} />
          </div>
        ))}
      </Card>

      <Card className="space-y-3 p-3">
        <div className="text-sm font-semibold">Schwellenwerte</div>
        <div className="flex items-center gap-2">
          <span className="w-44 text-xs text-muted-foreground">Minimale Confidence (0–1)</span>
          <Input value={minConf} onChange={(e) => setMinConf(e.target.value)} className="h-9 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-44 text-xs text-muted-foreground">Analyse-Debounce (Sek.)</span>
          <Input value={debounce} onChange={(e) => setDebounce(e.target.value)} className="h-9 w-24" />
        </div>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await setAiFlag('ai_min_confidence', minConf);
              await setAiFlag('ai_analysis_debounce_seconds', debounce);
              toast.success('Gespeichert.');
            } catch (e: any) { toast.error(e?.message || 'Speichern nicht möglich.'); }
          }}
        >
          SPEICHERN
        </Button>
      </Card>

      <Card className="p-3">
        <div className="mb-2 text-sm font-semibold">ALIX AI Qualität (30 Tage)</div>
        {!stats ? <Skeleton className="h-24" /> : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Analysen gesamt: <b>{stats.analyses}</b></div>
            <div>Heute: <b>{stats.today}</b></div>
            <div>Antwortvorschläge: <b>{stats.replies}</b></div>
            <div>Zusammenfassungen: <b>{stats.summaries}</b></div>
            <div>Fehlgeschlagen: <b>{stats.failed}</b></div>
            <div>Ø Confidence: <b>{stats.avgConfidence !== null ? `${stats.avgConfidence} %` : 'Nicht bekannt'}</b></div>
            <div>Akzeptiert: <b>{stats.accepted}</b></div>
            <div>Korrigiert: <b>{stats.corrected}</b></div>
            <div>Verworfen: <b>{stats.rejected}</b></div>
          </div>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Kostenmetriken werden nur angezeigt, wenn der Provider echte Werte liefert – keine geschätzten Zahlen.
        </p>
      </Card>
    </div>
  );
}
