import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ShieldCheck, User, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { navItems } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';

type Leaf = { path: string; label: string; group: string };

function collectLeaves(): Leaf[] {
  const out: Leaf[] = [];
  const walk = (items: any[], group: string) => {
    for (const it of items) {
      if (it.children && it.children.length > 0) {
        walk(it.children, it.path.startsWith('#') || it.label === group ? group : it.label);
      } else if (!it.path.startsWith('#')) {
        out.push({ path: it.path, label: it.label, group });
      }
    }
  };
  for (const top of navItems) {
    if (top.children && top.children.length > 0) walk(top.children, top.label);
    else if (!top.path.startsWith('#')) out.push({ path: top.path, label: top.label, group: top.label });
  }
  return out;
}

export default function ZugriffErteilen() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const leaves = useMemo(() => collectLeaves(), []);
  const grouped = useMemo(() => {
    const m = new Map<string, Leaf[]>();
    for (const l of leaves) {
      if (!m.has(l.group)) m.set(l.group, []);
      m.get(l.group)!.push(l);
    }
    return Array.from(m.entries());
  }, [leaves]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name');
      setUsers((data ?? []).filter((u: any) => u.is_active !== false));
    })();
  }, []);

  useEffect(() => {
    if (!selected) { setGranted(new Set()); setInitial(new Set()); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase.from('user_menu_grants' as any).select('path').eq('user_id', selected);
      const s = new Set<string>((data ?? []).map((r: any) => r.path));
      setGranted(s);
      setInitial(new Set(s));
      setLoading(false);
    })();
  }, [selected]);

  const toggle = (path: string) => {
    setGranted(prev => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
    });
  };

  const toggleGroup = (items: Leaf[], allOn: boolean) => {
    setGranted(prev => {
      const n = new Set(prev);
      for (const it of items) allOn ? n.delete(it.path) : n.add(it.path);
      return n;
    });
  };

  const selectAll = () => setGranted(new Set(leaves.map(l => l.path)));
  const clearAll = () => setGranted(new Set());

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const del = await supabase.from('user_menu_grants' as any).delete().eq('user_id', selected);
      if (del.error) throw del.error;
      if (granted.size > 0) {
        const rows = Array.from(granted).map(path => ({ user_id: selected, path, created_by: profile?.id ?? null }));
        const ins = await supabase.from('user_menu_grants' as any).insert(rows);
        if (ins.error) throw ins.error;
      }
      setInitial(new Set(granted));
      toast.success(granted.size === 0 ? 'Freigaben zurückgesetzt (Rollenlogik gilt).' : `${granted.size} Menüpunkte freigegeben.`);
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? 'Unbekannt'));
    } finally {
      setSaving(false);
    }
  };

  const dirty = granted.size !== initial.size || Array.from(granted).some(p => !initial.has(p));
  const user = users.find(u => u.id === selected);
  const q = search.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Zugriff erteilen</h2>
            <p className="text-xs text-muted-foreground">Wähle einen Mitarbeiter und markiere die Menüpunkte, die sichtbar sein sollen. Ohne Auswahl gilt weiterhin die normale Rollenlogik.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Mitarbeiter auswählen…" /></SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Menü filtern…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <div className="flex-1" />
          {selected && (
            <>
              <Button variant="outline" size="sm" onClick={selectAll}><CheckSquare className="w-4 h-4 mr-1" />Alle</Button>
              <Button variant="outline" size="sm" onClick={clearAll}><Square className="w-4 h-4 mr-1" />Keine</Button>
              <Button size="sm" onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Speichern
              </Button>
            </>
          )}
        </div>
        {user && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5" /> {user.full_name} · {user.email}
            <Badge variant="outline" className="ml-2">{granted.size} von {leaves.length} freigegeben</Badge>
            {initial.size === 0 && <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-500">Aktuell: Rollenlogik aktiv</Badge>}
          </div>
        )}
      </Card>

      {!selected ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Bitte einen Mitarbeiter auswählen.</Card>
      ) : loading ? (
        <Card className="p-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {grouped.map(([group, items]) => {
            const filtered = q
              ? items.filter(l => l.label.toLowerCase().includes(q) || l.path.toLowerCase().includes(q) || group.toLowerCase().includes(q))
              : items;
            if (filtered.length === 0) return null;
            const allOn = filtered.every(l => granted.has(l.path));
            return (
              <Card key={group} className="p-3">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/60">
                  <div className="font-semibold text-sm">{group}</div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(filtered, allOn)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {allOn ? 'alle abwählen' : 'alle wählen'}
                  </button>
                </div>
                <div className="space-y-1">
                  {filtered.map(l => (
                    <label key={l.path} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer text-sm">
                      <Checkbox checked={granted.has(l.path)} onCheckedChange={() => toggle(l.path)} />
                      <span className="flex-1 truncate">{l.label}</span>
                      <code className="text-[10px] text-muted-foreground truncate max-w-[40%]">{l.path}</code>
                    </label>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
