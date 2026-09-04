import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { PlmField, plmLabel, statusTone } from '@/lib/plm/config';
import { PlmFileInput, PlmThumb } from '@/components/plm/PlmFileInput';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];

interface Props {
  table: string;
  title: string;
  subtitle?: string;
  icon: any;
  fields: PlmField[];
  orderBy?: string;
  ascending?: boolean;
  extraFilter?: (q: any) => any;
  defaults?: Record<string, any>;
  onRowClick?: (row: any) => void;
}

export function statusBadge(value?: string | null) {
  const tone = statusTone(value);
  const cls =
    tone === 'ok' ? 'border-emerald-500/40 text-emerald-500'
    : tone === 'bad' ? 'border-destructive/50 text-destructive'
    : tone === 'muted' ? 'border-border text-muted-foreground'
    : 'border-amber-500/40 text-amber-500';
  return <Badge variant="outline" className={cls}>{plmLabel(value)}</Badge>;
}

export function PlmCrudPage({
  table, title, subtitle, icon, fields, orderBy = 'created_at', ascending = false,
  extraFilter, defaults, onRowClick,
}: Props) {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));
  const canDelete = (roles || []).includes('Super Admin');

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [refs, setRefs] = useState<Record<string, any[]>>({});

  const listFields = useMemo(() => fields.filter(f => f.list), [fields]);
  const groups = useMemo(() => {
    const g: Record<string, PlmField[]> = {};
    fields.forEach(f => { const k = f.group || 'Stammdaten'; (g[k] ||= []).push(f); });
    return g;
  }, [fields]);

  const load = useCallback(async () => {
    setLoading(true);
    let q: any = (supabase.from(table as any) as any).select('*').order(orderBy, { ascending }).limit(1000);
    if (extraFilter) q = extraFilter(q);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as any[]) || []);
    setLoading(false);
  }, [table, orderBy, ascending]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refFields = fields.filter(f => f.type === 'ref' && f.refTable);
    if (!refFields.length) return;
    (async () => {
      const out: Record<string, any[]> = {};
      for (const f of refFields) {
        const cols = ['id', f.refLabel || 'name', f.refExtra].filter(Boolean).join(',');
        const { data } = await (supabase.from(f.refTable as any) as any).select(cols).limit(1000);
        out[f.key] = (data as any[]) || [];
      }
      setRefs(out);
    })();
  }, [fields]);

  const refText = (f: PlmField, id: string | null) => {
    if (!id) return '—';
    const r = (refs[f.key] || []).find((x: any) => x.id === id);
    if (!r) return '—';
    return [r[f.refExtra || ''], r[f.refLabel || 'name']].filter(Boolean).join(' · ');
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(s));
  }, [rows, search]);

  function openNew() {
    setEditing(null);
    const init: Record<string, any> = { ...(defaults || {}) };
    fields.forEach(f => { if (init[f.key] === undefined) init[f.key] = f.type === 'boolean' ? false : ''; });
    setForm(init);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    const init: Record<string, any> = {};
    fields.forEach(f => {
      const v = row[f.key];
      init[f.key] = f.type === 'tags' ? (Array.isArray(v) ? v.join(', ') : '') : (v ?? (f.type === 'boolean' ? false : ''));
    });
    setForm(init);
    setOpen(true);
  }

  async function save() {
    const missing = fields
      .filter(f => f.required && f.type !== 'boolean')
      .filter(f => {
        const v = form[f.key];
        return v === undefined || v === null || String(v).trim() === '';
      });
    if (missing.length) {
      toast.error(`Pflichtfelder fehlen: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    const payload: Record<string, any> = { ...(defaults || {}) };
    for (const f of fields) {
      let v = form[f.key];
      if (f.type === 'number') v = v === '' || v === null ? null : Number(v);
      else if (f.type === 'boolean') v = !!v;
      else if (f.type === 'tags') v = String(v || '').split(',').map(s => s.trim()).filter(Boolean);
      else if (v === '') v = null;
      // Beim Anlegen leere Felder weglassen, damit DB-Defaults (z. B. Status, Revision) greifen
      // und NOT-NULL-Spalten nicht mit explizitem NULL überschrieben werden.
      if (!editing && (v === null || v === undefined)) continue;
      payload[f.key] = v;
    }
    setSaving(true);
    const res = editing
      ? await (supabase.from(table as any) as any).update(payload).eq('id', editing.id)
      : await (supabase.from(table as any) as any).insert(payload);
    setSaving(false);
    if (res.error) {
      const msg = /null value in column "([^"]+)"/.exec(res.error.message);
      if (msg) {
        const label = fields.find(f => f.key === msg[1])?.label ?? msg[1];
        return toast.error(`Pflichtfeld darf nicht leer sein: ${label}`);
      }
      return toast.error(res.error.message);
    }

    await supabase.from('plm_audit_log' as any).insert({
      entity_type: table, entity_id: editing?.id ?? null,
      action: editing ? 'update' : 'create', changes: payload as any,
    } as any);
    toast.success(editing ? 'Gespeichert' : 'Angelegt');
    setOpen(false);
    load();
  }

  async function remove(row: any) {
    if (!confirm('Datensatz wirklich löschen?')) return;
    const { error } = await (supabase.from(table as any) as any).delete().eq('id', row.id);
    if (error) return toast.error(error.message);
    await supabase.from('plm_audit_log' as any).insert({
      entity_type: table, entity_id: row.id, action: 'delete', changes: row as any,
    } as any);
    toast.success('Gelöscht');
    load();
  }

  function cellValue(f: PlmField, row: any) {
    const v = row[f.key];
    if (f.type === 'ref') return refText(f, v);
    if (f.type === 'image') return <PlmThumb value={v} />;
    if (f.type === 'file') return v ? 'Datei' : '—';
    if (f.type === 'boolean') return v ? 'Ja' : 'Nein';
    if (f.type === 'tags') return Array.isArray(v) ? v.join(', ') : '—';
    if (f.type === 'select') return statusBadge(v);
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  }


  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader icon={icon} title={title} subtitle={subtitle} noBreadcrumbs />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} Einträge</span>
          {canWrite && (
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Neu</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {listFields.map(f => <TableHead key={f.key}>{f.label}</TableHead>)}
                  <TableHead className="w-24 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => (
                  <TableRow
                    key={row.id}
                    className={onRowClick ? 'cursor-pointer' : ''}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {listFields.map(f => (
                      <TableCell key={f.key} className={f.mono ? 'font-mono text-xs' : 'text-sm'}>
                        {cellValue(f, row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {canWrite && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => remove(row)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={listFields.length + 1} className="text-center text-sm text-muted-foreground py-10">
                      Keine Einträge
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `${title} bearbeiten` : `${title} — neu`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {Object.entries(groups).map(([group, gf]) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gf.map(f => (
                    <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
                      <Label className="text-xs">{f.label}{f.required ? <span className="text-destructive"> *</span> : null}</Label>
                      {f.type === 'textarea' ? (
                        <Textarea rows={3} value={form[f.key] ?? ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} />
                      ) : f.type === 'select' ? (
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={form[f.key] ?? ''}
                          onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                        >
                          <option value="">— bitte wählen —</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{plmLabel(o)}</option>)}
                        </select>
                      ) : f.type === 'ref' ? (
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={form[f.key] ?? ''}
                          onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                        >
                          <option value="">— keine —</option>
                          {(refs[f.key] || []).map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {[r[f.refExtra || ''], r[f.refLabel || 'name']].filter(Boolean).join(' · ')}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'boolean' ? (
                        <label className="flex items-center gap-2 h-9 text-sm">
                          <input type="checkbox" checked={!!form[f.key]} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.checked }))} />
                          <span className="text-muted-foreground">{f.label}</span>
                        </label>
                      ) : f.type === 'image' || f.type === 'file' ? (
                        <PlmFileInput
                          value={form[f.key] ?? ''}
                          image={f.type === 'image'}
                          folder={table}
                          onChange={p => setForm(s => ({ ...s, [f.key]: p ?? '' }))}
                        />
                      ) : (

                        <Input
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          value={form[f.key] ?? ''}
                          onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
