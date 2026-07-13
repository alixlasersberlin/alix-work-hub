import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search } from 'lucide-react';

interface LogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string | null;
  action: string;
  source: string | null;
  performed_by: string | null;
  performed_at: string;
  note: string | null;
  old_value: any;
  new_value: any;
}

const ACTION_TONES: Record<string, string> = {
  insert: 'bg-emerald-500/15 text-emerald-500',
  update: 'bg-amber-500/15 text-amber-500',
  delete: 'bg-red-500/15 text-red-500',
  approve: 'bg-primary/15 text-primary',
  submit: 'bg-blue-500/15 text-blue-500',
};

export default function KatalogProtokolle() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('catalog_change_log')
      .select('*')
      .order('performed_at', { ascending: false })
      .limit(1000);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (entity !== 'all' && r.entity_type !== entity) return false;
      if (action !== 'all' && r.action !== action) return false;
      if (!needle) return true;
      return (
        r.entity_id.toLowerCase().includes(needle) ||
        (r.field_name ?? '').toLowerCase().includes(needle) ||
        (r.source ?? '').toLowerCase().includes(needle) ||
        (r.note ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, entity, action]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche in ID, Feld, Quelle, Notiz…" className="pl-9" />
        </div>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Objekte</SelectItem>
            <SelectItem value="catalog_item">Artikel</SelectItem>
            <SelectItem value="catalog_item_price">Preis</SelectItem>
            <SelectItem value="catalog_item_description">Beschreibung</SelectItem>
            <SelectItem value="catalog_item_image">Bild</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Aktionen</SelectItem>
            <SelectItem value="insert">Anlage</SelectItem>
            <SelectItem value="update">Änderung</SelectItem>
            <SelectItem value="delete">Löschung</SelectItem>
            <SelectItem value="approve">Freigabe</SelectItem>
            <SelectItem value="submit">Einreichung</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Neu laden
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeit</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Objekt</TableHead>
                <TableHead>Feld</TableHead>
                <TableHead>Quelle</TableHead>
                <TableHead className="text-right w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Lade…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Einträge.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <>
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.performed_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell><Badge variant="secondary" className={ACTION_TONES[r.action] ?? ''}>{r.action}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.entity_type}:{String(r.entity_id).slice(0, 8)}</TableCell>
                    <TableCell>{r.field_name ?? '—'}</TableCell>
                    <TableCell>{r.source ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        {expanded === r.id ? 'Zu' : 'Diff'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded === r.id && (
                    <TableRow key={`${r.id}-diff`}>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="font-semibold text-muted-foreground mb-1">Vorher</div>
                            <pre className="whitespace-pre-wrap break-all bg-background/50 p-2 rounded max-h-60 overflow-auto">
                              {r.old_value ? JSON.stringify(r.old_value, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div className="font-semibold text-muted-foreground mb-1">Nachher</div>
                            <pre className="whitespace-pre-wrap break-all bg-background/50 p-2 rounded max-h-60 overflow-auto">
                              {r.new_value ? JSON.stringify(r.new_value, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                        {r.note && <div className="mt-2 text-xs italic text-muted-foreground">{r.note}</div>}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
