import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { STAGES } from '@/lib/delivery-approval/config';
import {
  DEFAULT_APPROVAL_SETTINGS, fetchApprovalSettings, saveApprovalSettings, HOLIDAYS_DE_AT_2026,
  type ApprovalSettings, type Absence,
} from '@/lib/delivery-approval/settings';

export default function ApprovalSettingsDialog({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSaved?: (cfg: ApprovalSettings) => void }) {
  const [cfg, setCfg] = useState<ApprovalSettings>(DEFAULT_APPROVAL_SETTINGS);
  const [holidays, setHolidays] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetchApprovalSettings().then((c) => { setCfg(c); setHolidays((c.holidays ?? []).join('\n')); });
  }, [open]);

  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

  const setAbsence = (i: number, patch: Partial<Absence>) =>
    setCfg((prev) => ({
      ...prev,
      absences: (prev.absences ?? []).map((a, x) => (x === i ? { ...a, ...patch } : a)),
    }));

  const save = async () => {
    setBusy(true);
    try {
      const next: ApprovalSettings = {
        ...cfg,
        holidays: holidays.split(/[\n,;]/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
      };
      await saveApprovalSettings(next);
      toast.success('SLA-Einstellungen gespeichert');
      onSaved?.(next);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Speichern fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>SLA & Zielwerte der Auslieferungsfreigabe</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">Überfällig ab (h)</Label>
              <Input type="number" min={1} value={cfg.overdueHours}
                onChange={(e) => setCfg({ ...cfg, overdueHours: num(e.target.value, 12) })} />
            </div>
            <div>
              <Label className="text-xs">Eskalation 1 (h)</Label>
              <Input type="number" min={1} value={cfg.l1} onChange={(e) => setCfg({ ...cfg, l1: num(e.target.value, 24) })} />
            </div>
            <div>
              <Label className="text-xs">Eskalation 2 (h)</Label>
              <Input type="number" min={1} value={cfg.l2} onChange={(e) => setCfg({ ...cfg, l2: num(e.target.value, 48) })} />
            </div>
            <div>
              <Label className="text-xs">Eskalation 3 (h)</Label>
              <Input type="number" min={1} value={cfg.l3} onChange={(e) => setCfg({ ...cfg, l3: num(e.target.value, 72) })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Nur Werktage zählen</div>
              <div className="text-xs text-muted-foreground">Samstage, Sonntage und Feiertage pausieren die Fristen.</div>
            </div>
            <Switch checked={cfg.businessDaysOnly} onCheckedChange={(v) => setCfg({ ...cfg, businessDaysOnly: v })} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Ein-Klick-Freigabe per E-Mail</div>
              <div className="text-xs text-muted-foreground">Erinnerungs-Mails enthalten einen persönlichen Freigabe-Link (14 Tage gültig).</div>
            </div>
            <Switch checked={cfg.oneClickApproval} onCheckedChange={(v) => setCfg({ ...cfg, oneClickApproval: v })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Feiertage (ein Datum je Zeile, YYYY-MM-DD)</Label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setHolidays((prev) => {
                  const set = new Set([...prev.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean), ...HOLIDAYS_DE_AT_2026]);
                  return Array.from(set).sort().join('\n');
                })}
              >
                Feiertage DE/AT 2026 einfügen
              </Button>
            </div>
            <Textarea rows={4} value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2026-12-25" />
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Vertretungsregelung</div>
                <div className="text-xs text-muted-foreground">
                  Während der Abwesenheit gehen Erinnerungen und 1-Klick-Links an den Vertreter.
                </div>
              </div>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setCfg({
                  ...cfg,
                  absences: [...(cfg.absences ?? []), { email: '', deputyEmail: '', from: '', to: '' } as Absence],
                })}
              >
                Vertretung hinzufügen
              </Button>
            </div>

            {(cfg.absences ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">Keine Abwesenheiten hinterlegt.</div>
            )}

            {(cfg.absences ?? []).map((a, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1.4fr_1fr_1fr_auto] items-end">
                <div>
                  <Label className="text-xs">Abwesend (E-Mail)</Label>
                  <Input type="email" value={a.email} placeholder="max@alix-operation.de"
                    onChange={(e) => setAbsence(i, { email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Vertretung (E-Mail)</Label>
                  <Input type="email" value={a.deputyEmail} placeholder="vertretung@alix-operation.de"
                    onChange={(e) => setAbsence(i, { deputyEmail: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Von</Label>
                  <Input type="date" value={a.from} onChange={(e) => setAbsence(i, { from: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Bis</Label>
                  <Input type="date" value={a.to} onChange={(e) => setAbsence(i, { to: e.target.value })} />
                </div>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => setCfg({ ...cfg, absences: (cfg.absences ?? []).filter((_, x) => x !== i) })}>
                  Entfernen
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Automatischer Monatsreport</div>
                <div className="text-xs text-muted-foreground">
                  Am 1. jedes Monats um 06:00 UTC gehen die Durchlaufzeiten des Vormonats per E-Mail an die Leitung.
                </div>
              </div>
              <Switch
                checked={cfg.monthlyReport?.enabled ?? false}
                onCheckedChange={(v) => setCfg({
                  ...cfg,
                  monthlyReport: { enabled: v, recipients: cfg.monthlyReport?.recipients ?? [] },
                })}
              />
            </div>
            <div>
              <Label className="text-xs">Empfänger (Komma-getrennt)</Label>
              <Input
                value={(cfg.monthlyReport?.recipients ?? []).join(', ')}
                placeholder="jh@alix-operation.de, k.trinh@alix-operation.de"
                onChange={(e) => setCfg({
                  ...cfg,
                  monthlyReport: {
                    enabled: cfg.monthlyReport?.enabled ?? false,
                    recipients: e.target.value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
                  },
                })}
              />
            </div>
          </div>


          <div>
            <div className="text-sm font-medium mb-2">KPI-Zielwerte (Ø Stunden bis Freigabe)</div>
            <div className="grid gap-3 sm:grid-cols-4">
              {STAGES.map((s) => (
                <div key={s.stage}>
                  <Label className="text-xs">{s.title}</Label>
                  <Input type="number" min={1} value={cfg.targets[s.stage]}
                    onChange={(e) => setCfg({ ...cfg, targets: { ...cfg.targets, [s.stage]: num(e.target.value, 24) } })} />
                </div>
              ))}
              <div>
                <Label className="text-xs">Gesamt</Label>
                <Input type="number" min={1} value={cfg.targets.total}
                  onChange={(e) => setCfg({ ...cfg, targets: { ...cfg.targets, total: num(e.target.value, 48) } })} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Speichern…' : 'Speichern'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
