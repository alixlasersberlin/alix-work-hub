import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Boxes, Wrench, Network, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Row { id: string; [k: string]: any }

interface Node {
  key: string;
  label: string;
  sub?: string;
  kind: 'assembly' | 'part';
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  totalPrice: number;
  children: Node[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function PlmStuecklistenbaum() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Row[]>([]);
  const [assemblies, setAssemblies] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [bom, setBom] = useState<Row[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, a, p, b] = await Promise.all([
        supabase.from('plm_devices' as any).select('id,name,article_number').order('name'),
        supabase.from('plm_assemblies' as any).select('id,name,code').limit(2000),
        supabase.from('plm_parts' as any).select('id,name,part_number,price').limit(5000),
        supabase.from('plm_bom_items' as any).select('*').limit(5000),
      ]);
      const err = d.error || a.error || p.error || b.error;
      if (err) toast.error(err.message);
      setDevices((d.data as any[]) || []);
      setAssemblies((a.data as any[]) || []);
      setParts((p.data as any[]) || []);
      setBom((b.data as any[]) || []);
      if (!deviceId && (d.data as any[])?.length) setDeviceId((d.data as any[])[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assemblyMap = useMemo(() => Object.fromEntries(assemblies.map(a => [a.id, a])), [assemblies]);
  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);

  const tree = useMemo<Node[]>(() => {
    if (!deviceId) return [];
    const build = (items: Row[], path: string, seen: Set<string>): Node[] =>
      items
        .sort((x, y) => (x.position_no || 0) - (y.position_no || 0))
        .map((it) => {
          const qty = Number(it.quantity ?? 1) || 1;
          if (it.child_assembly_id) {
            const asm = assemblyMap[it.child_assembly_id];
            const key = `${path}/${it.id}`;
            const nextSeen = new Set(seen);
            let children: Node[] = [];
            if (!seen.has(it.child_assembly_id)) {
              nextSeen.add(it.child_assembly_id);
              children = build(bom.filter(b => b.assembly_id === it.child_assembly_id), key, nextSeen);
            }
            const childSum = children.reduce((s, c) => s + c.totalPrice, 0);
            return {
              key,
              label: asm?.name || 'Unbekannte Baugruppe',
              sub: asm?.code,
              kind: 'assembly' as const,
              quantity: qty,
              unit: it.unit,
              unitPrice: childSum,
              totalPrice: childSum * qty,
              children,
            };
          }
          const part = partMap[it.part_id];
          const unitPrice = Number(part?.price ?? 0) || 0;
          return {
            key: `${path}/${it.id}`,
            label: part?.name || 'Unbekanntes Teil',
            sub: part?.part_number,
            kind: 'part' as const,
            quantity: qty,
            unit: it.unit,
            unitPrice,
            totalPrice: unitPrice * qty,
            children: [],
          };
        });

    const rootItems = bom.filter(b => b.device_id === deviceId && !b.assembly_id);
    const nodes = build(rootItems, 'root', new Set());
    // Baugruppen, die direkt am Gerät hängen, aber nicht über BOM referenziert sind
    return nodes;
  }, [deviceId, bom, assemblyMap, partMap]);

  const total = tree.reduce((s, n) => s + n.totalPrice, 0);
  const countNodes = (nodes: Node[]): number =>
    nodes.reduce((s, n) => s + 1 + countNodes(n.children), 0);

  const renderNode = (n: Node, level: number) => {
    const isOpen = !collapsed[n.key];
    const hasChildren = n.children.length > 0;
    const Icon = n.kind === 'assembly' ? Boxes : Wrench;
    return (
      <div key={n.key}>
        <div
          className="flex items-center gap-2 border-b border-border/50 py-2 text-sm hover:bg-muted/40"
          style={{ paddingLeft: 8 + level * 20 }}
        >
          {hasChildren ? (
            <button
              onClick={() => setCollapsed(c => ({ ...c, [n.key]: isOpen }))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={isOpen ? 'Einklappen' : 'Ausklappen'}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Icon className={`h-4 w-4 ${n.kind === 'assembly' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="flex-1 truncate">{n.label}</span>
          {n.sub && <span className="hidden font-mono text-xs text-muted-foreground md:inline">{n.sub}</span>}
          <Badge variant="outline" className="shrink-0">
            {n.quantity} {n.unit || 'Stk'}
          </Badge>
          <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{fmt(n.unitPrice)}</span>
          <span className="w-28 shrink-0 pr-3 text-right font-medium">{fmt(n.totalPrice)}</span>
        </div>
        {isOpen && n.children.map(c => renderNode(c, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Stücklisten-Explorer"
        subtitle="Mehrstufige BOM als Baum mit automatischer Kostenrollierung."
        icon={Network}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <label className="text-sm text-muted-foreground" htmlFor="plm-device">Gerät</label>
          <select
            id="plm-device"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="h-9 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Gerät wählen —</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}{d.article_number ? ` (${d.article_number})` : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => setCollapsed({})}>Alle ausklappen</Button>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Positionen: {countNodes(tree)}</span>
            <span className="font-semibold">Materialkosten: {fmt(total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Stückliste…
            </div>
          ) : !deviceId ? (
            <div className="p-10 text-center text-muted-foreground">Bitte ein Gerät auswählen.</div>
          ) : tree.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              Für dieses Gerät sind noch keine Stücklistenpositionen erfasst.
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-2 text-xs uppercase text-muted-foreground">
                <span className="w-4" />
                <span className="flex-1 pl-6">Bezeichnung</span>
                <span className="w-24 text-right">Einzelpreis</span>
                <span className="w-28 pr-3 text-right">Gesamt</span>
              </div>
              {tree.map(n => renderNode(n, 0))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
