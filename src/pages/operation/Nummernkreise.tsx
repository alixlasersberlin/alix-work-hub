import { useEffect, useMemo, useState } from 'react';
import { Hash, Loader2, Pencil, Save, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDocumentNumberPreview, formatCaseSuffixPreview } from '@/lib/number-ranges';

type Range = {
  code: string;
  label: string;
  prefix: string;
  separator: string;
  include_year: boolean;
  padding: number;
  start_value: number;
  current_value: number;
  reset_yearly: boolean;
  last_reset_year: number | null;
  active: boolean;
  inherit_case: boolean;
  notes: string | null;
  updated_at: string;
};

export default function Nummernkreise() {
  const [rows, setRows] = useState<Range[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Range | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('number_ranges' as any)
      .select('*')
      .order('label', { ascending: true });
    if (error) {
      toast.error('Fehler beim Laden: ' + error.message);
      setRows([]);
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.label.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.prefix.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function toggleActive(r: Range, next: boolean) {
    const { error } = await supabase
      .from('number_ranges' as any)
      .update({ active: next } as any)
      .eq('code', r.code);
    if (error) { toast.error(error.message); return; }
    setRows(rs => rs.map(x => x.code === r.code ? { ...x, active: next } : x));
    toast.success(next
      ? `„${r.label}" – Nummernkreis ist jetzt systemweit aktiv.`
      : `„${r.label}" – Nummernkreis deaktiviert (Legacy-Logik aktiv).`);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const patch: any = {
      label: editing.label,
      prefix: editing.prefix,
      separator: editing.separator || '-',
      include_year: editing.include_year,
      padding: Math.max(1, Math.min(12, editing.padding || 5)),
      start_value: Math.max(0, Number(editing.start_value) || 0),
      reset_yearly: editing.reset_yearly,
      inherit_case: editing.inherit_case,
      notes: editing.notes || null,
    };
    // Wenn current_value < start_value-1 → auf start_value-1 ziehen, damit
    // die nächste Nummer = start_value liefert.
    if (editing.current_value < patch.start_value - 1) {
      patch.current_value = patch.start_value - 1;
    }
    const { error } = await supabase
      .from('number_ranges' as any)
      .update(patch)
      .eq('code', editing.code);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Nummernkreis gespeichert.');
    setEditing(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Hash className="w-5 h-5 text-primary" /> Nummernkreise
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zentrale Verwaltung der Vorgangs- und Dokumentnummern. Aktivierte Kreise werden
            systemweit für neue Vorgänge verwendet; deaktivierte Kreise lassen die bisherige
            (Legacy-)Nummernlogik unverändert weiterlaufen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-56 bg-secondary border-border"
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={'w-4 h-4 mr-2 ' + (loading ? 'animate-spin' : '')} />
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Aktiv</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Präfix</TableHead>
              <TableHead>Jahr</TableHead>
              <TableHead className="text-right">Stellen</TableHead>
              <TableHead className="text-right">Start</TableHead>
              <TableHead className="text-right">Aktueller Wert</TableHead>
              <TableHead>Nächste Vorschau</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Lade…
              </TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                Keine Einträge.
              </TableCell></TableRow>
            )}
            {filtered.map(r => {
              const nextValue = Math.max(r.current_value + 1, r.start_value);
              const preview = r.inherit_case
                ? formatCaseSuffixPreview(r.prefix, r.separator)
                : formatDocumentNumberPreview({
                    prefix: r.prefix,
                    separator: r.separator,
                    include_year: r.include_year,
                    padding: r.padding,
                    value: nextValue,
                  });
              return (
                <TableRow key={r.code} className={r.active ? '' : 'opacity-70'}>
                  <TableCell>
                    <Switch checked={r.active} onCheckedChange={(v) => toggleActive(r, v)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.label}
                    {r.inherit_case && (
                      <span className="ml-2 inline-block rounded bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 align-middle">
                        Vorgangs-Nr
                      </span>
                    )}
                  </TableCell>
                  <TableCell><code className="text-xs">{r.code}</code></TableCell>
                  <TableCell>{r.prefix || '—'}</TableCell>
                  <TableCell>{r.inherit_case ? '—' : (r.include_year ? 'Ja' : 'Nein')}</TableCell>
                  <TableCell className="text-right">{r.inherit_case ? '—' : r.padding}</TableCell>
                  <TableCell className="text-right">{r.inherit_case ? '—' : r.start_value}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.inherit_case ? '—' : r.current_value}</TableCell>
                  <TableCell><code className="text-xs text-primary">{preview}</code></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              {editing?.label} bearbeiten
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
                  <Input value={editing.label}
                         onChange={e => setEditing(s => s ? { ...s, label: e.target.value } : s)}
                         className="bg-secondary border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Code (read-only)</Label>
                  <Input value={editing.code} readOnly className="bg-muted border-border mt-1 font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Präfix</Label>
                  <Input value={editing.prefix}
                         onChange={e => setEditing(s => s ? { ...s, prefix: e.target.value } : s)}
                         className="bg-secondary border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Trenner</Label>
                  <Input value={editing.separator}
                         onChange={e => setEditing(s => s ? { ...s, separator: e.target.value } : s)}
                         className="bg-secondary border-border mt-1" maxLength={3} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Stellen Zähler</Label>
                  <Input type="number" min={1} max={12} value={editing.padding}
                         onChange={e => setEditing(s => s ? { ...s, padding: Number(e.target.value) || 1 } : s)}
                         className="bg-secondary border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Startwert</Label>
                  <Input type="number" min={0} value={editing.start_value}
                         onChange={e => setEditing(s => s ? { ...s, start_value: Number(e.target.value) || 0 } : s)}
                         className="bg-secondary border-border mt-1" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Jahr im Nummernformat</div>
                  <div className="text-xs text-muted-foreground">z. B. ANG-2026-00001</div>
                </div>
                <Switch checked={editing.include_year}
                        onCheckedChange={(v) => setEditing(s => s ? { ...s, include_year: v } : s)} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Jährlich zurücksetzen</div>
                  <div className="text-xs text-muted-foreground">
                    Der Zähler startet zum Jahreswechsel wieder beim Startwert.
                  </div>
                </div>
                <Switch checked={editing.reset_yearly}
                        onCheckedChange={(v) => setEditing(s => s ? { ...s, reset_yearly: v } : s)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Notiz</Label>
                <Textarea value={editing.notes || ''}
                          onChange={e => setEditing(s => s ? { ...s, notes: e.target.value } : s)}
                          rows={2} className="bg-secondary border-border mt-1" />
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="text-xs text-muted-foreground">Nächste vergebene Nummer (Vorschau):</div>
                <div className="font-mono text-base text-primary">
                  {formatDocumentNumberPreview({
                    prefix: editing.prefix,
                    separator: editing.separator,
                    include_year: editing.include_year,
                    padding: editing.padding,
                    value: Math.max(editing.current_value + 1, editing.start_value),
                  })}
                </div>
              </div>

              {editing.current_value > editing.start_value && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Achtung: Der aktuelle Zählerstand ({editing.current_value}) liegt bereits über
                  dem konfigurierten Startwert. Eine Änderung des Startwerts setzt den Zähler
                  nicht zurück – dafür müsste der Wert direkt in der Datenbank korrigiert werden.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              <X className="w-4 h-4 mr-2" /> Abbrechen
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="gold-gradient text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
