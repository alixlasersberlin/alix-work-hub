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
            <Label className="text-xs">Feiertage (ein Datum je Zeile, YYYY-MM-DD)</Label>
            <Textarea rows={4} value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2026-12-25" />
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
