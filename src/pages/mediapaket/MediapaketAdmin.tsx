import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings as SettingsIcon, BarChart3, Package as PackageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const KEYS = {
  defaultDueDays: 'mediapaket.default_due_days',
  allowedMimeTypes: 'mediapaket.allowed_mime_types',
  maxFileSizeMb: 'mediapaket.max_file_size_mb',
  reminderDaysBefore: 'mediapaket.reminder_days_before',
  staffInbox: 'mediapaket.staff_inbox',
  customerIntroText: 'mediapaket.customer_intro_text',
  submitConfirmText: 'mediapaket.submit_confirm_text',
} as const;

const DEFAULTS: Record<string, string> = {
  [KEYS.defaultDueDays]: '14',
  [KEYS.allowedMimeTypes]: 'image/jpeg,image/png,image/webp,application/pdf,video/mp4',
  [KEYS.maxFileSizeMb]: '50',
  [KEYS.reminderDaysBefore]: '3',
  [KEYS.staffInbox]: 'vertrieb@alixwork.de',
  [KEYS.customerIntroText]: 'Willkommen! Bitte fülle dein Mediapaket vollständig aus, damit wir mit deiner Website / deinem Flyer starten können.',
  [KEYS.submitConfirmText]: 'Mit dem Absenden bestätigst du, dass alle Angaben vollständig und korrekt sind.',
};

export default function MediapaketAdmin() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [values, setValues] = useState<Record<string, string>>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<{ byStatus: Record<string, number>; totalFiles: number; totalDownloads: number; avgProgress: number } | null>(null);

  useEffect(() => {
    (async () => {
      const keys = Object.values(KEYS);
      const { data } = await supabase.from('app_settings').select('key, value').in('key', keys);
      const map: Record<string, string> = { ...DEFAULTS };
      (data || []).forEach((r: any) => { if (r.value !== null) map[r.key] = r.value; });
      setValues(map);
      // Stats
      const [mps, files, downloads] = await Promise.all([
        supabase.from('media_packages').select('status, progress_percent'),
        supabase.from('media_package_files').select('id', { count: 'exact', head: true }),
        supabase.from('media_package_file_downloads').select('id', { count: 'exact', head: true }),
      ]);
      const byStatus: Record<string, number> = {};
      let progSum = 0, progN = 0;
      (mps.data || []).forEach((r: any) => {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        if (typeof r.progress_percent === 'number') { progSum += r.progress_percent; progN++; }
      });
      setStats({
        byStatus,
        totalFiles: files.count || 0,
        totalDownloads: downloads.count || 0,
        avgProgress: progN ? Math.round(progSum / progN) : 0,
      });
      setLoading(false);
    })();
  }, []);

  const setV = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const rows = Object.entries(values).map(([key, value]) => ({ key, value, updated_by: userData.user?.id ?? null, updated_at: new Date().toISOString() }));
    const { error } = await (supabase.from('app_settings') as any).upsert(rows, { onConflict: 'key' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Einstellungen gespeichert');
  };

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Nur Super Admins haben Zugriff auf den Mediapaket-Konfigurator.</div>;
  }
  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Mediapaket-Konfigurator</h1>
        <Badge variant="outline">Super Admin</Badge>
      </div>

      {/* Stats */}
      {stats && (
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Statistik</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <StatBox label="Ø Fortschritt" value={`${stats.avgProgress}%`} />
            <StatBox label="Dateien gesamt" value={stats.totalFiles} />
            <StatBox label="Downloads gesamt" value={stats.totalDownloads} />
            <StatBox label="Pakete gesamt" value={Object.values(stats.byStatus).reduce((a, b) => a + b, 0)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <div key={s} className="flex items-center justify-between text-xs border border-border/50 rounded-lg px-2 py-1">
                <span className="text-muted-foreground truncate">{s}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <PackageIcon className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Fristen & Erinnerungen</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Standard-Frist (Tage)" hint="Für neu erstellte Mediapakete">
            <Input type="number" min={1} value={values[KEYS.defaultDueDays]} onChange={e => setV(KEYS.defaultDueDays, e.target.value)} />
          </Field>
          <Field label="Erinnerung (Tage vor Frist)">
            <Input type="number" min={0} value={values[KEYS.reminderDaysBefore]} onChange={e => setV(KEYS.reminderDaysBefore, e.target.value)} />
          </Field>
          <Field label="Max. Dateigröße (MB)">
            <Input type="number" min={1} value={values[KEYS.maxFileSizeMb]} onChange={e => setV(KEYS.maxFileSizeMb, e.target.value)} />
          </Field>
        </div>
        <Field label="Erlaubte MIME-Typen" hint="Kommagetrennt">
          <Input value={values[KEYS.allowedMimeTypes]} onChange={e => setV(KEYS.allowedMimeTypes, e.target.value)} />
        </Field>
        <Field label="Staff Inbox (E-Mail)" hint="Fallback wenn kein Zuständiger gesetzt ist">
          <Input type="email" value={values[KEYS.staffInbox]} onChange={e => setV(KEYS.staffInbox, e.target.value)} />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 card-glow space-y-4">
        <h2 className="text-sm font-semibold">Kundenkommunikation</h2>
        <Field label="Intro-Text (Portal Start)">
          <Textarea rows={3} value={values[KEYS.customerIntroText]} onChange={e => setV(KEYS.customerIntroText, e.target.value)} />
        </Field>
        <Field label="Bestätigungs-Text beim Absenden">
          <Textarea rows={3} value={values[KEYS.submitConfirmText]} onChange={e => setV(KEYS.submitConfirmText, e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gold-gradient text-primary-foreground">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Alle Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
