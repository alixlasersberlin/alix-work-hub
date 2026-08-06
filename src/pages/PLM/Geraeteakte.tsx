import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FolderKanban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { plmLabel, statusTone } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }

const toneClass: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

function StatusBadge({ value }: { value?: string | null }) {
  return <Badge variant="outline" className={toneClass[statusTone(value)]}>{plmLabel(value)}</Badge>;
}

export default function PlmGeraeteakte() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Row[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [assemblies, setAssemblies] = useState<Row[]>([]);
  const [bom, setBom] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Row[]>([]);
  const [drawings, setDrawings] = useState<Row[]>([]);
  const [changes, setChanges] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [instructions, setInstructions] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('plm_devices' as any).select('*').order('article_number').limit(500);
      if (error) toast.error(error.message);
      const list = (data as any[]) || [];
      setDevices(list);
      setDeviceId(prev => prev || list[0]?.id || '');
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    (async () => {
      setLoading(true);
      const [a, b, p, d, dr, c, o, wi] = await Promise.all([
        supabase.from('plm_assemblies' as any).select('*').eq('device_id', deviceId).limit(1000),
        supabase.from('plm_bom_items' as any).select('*').eq('device_id', deviceId).limit(2000),
        supabase.from('plm_parts' as any).select('id,name,part_number,release_status,criticality,price').limit(5000),
        supabase.from('plm_documents' as any).select('*').eq('entity_type', 'device').eq('entity_id', deviceId).limit(500),
        supabase.from('plm_drawings' as any).select('*').eq('device_id', deviceId).limit(500),
        supabase.from('plm_changes' as any).select('*').eq('device_id', deviceId).limit(500),
        supabase.from('plm_production_orders' as any).select('*').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(200),
        supabase.from('plm_work_instructions' as any).select('*').eq('device_id', deviceId).limit(200),
      ]);
      setAssemblies((a.data as any[]) || []);
      setBom((b.data as any[]) || []);
      setParts((p.data as any[]) || []);
      setDocs((d.data as any[]) || []);
      setDrawings((dr.data as any[]) || []);
      setChanges((c.data as any[]) || []);
      setOrders((o.data as any[]) || []);
      setInstructions((wi.data as any[]) || []);
      setLoading(false);
    })();
  }, [deviceId]);

  const device = useMemo(() => devices.find(d => d.id === deviceId), [devices, deviceId]);
  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);

  const bomParts = useMemo(
    () => bom.filter(b => b.part_id).map(b => ({ ...b, part: partMap[b.part_id] })).filter(b => b.part),
    [bom, partMap],
  );

  const openChanges = changes.filter(c => !['umgesetzt', 'geschlossen', 'abgelehnt'].includes(c.status));
  const criticalParts = bomParts.filter(b => ['hoch', 'sicherheitsrelevant'].includes(b.part?.criticality));
  const unreleasedParts = bomParts.filter(b => b.part?.release_status !== 'freigegeben');
  const expiredDocs = docs.filter(d => d.valid_until && new Date(d.valid_until) < new Date());

  const readiness = unreleasedParts.length === 0 && openChanges.length === 0 && expiredDocs.length === 0;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <PageHeader
        icon={FolderKanban}
        title="Geräteakte (Technische Dokumentation)"
        subtitle="Zusammengeführte technische Akte je Gerät: Struktur, Dokumente, Zeichnungen, Änderungen und Fertigung."
        noBreadcrumbs
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">Gerät</label>
          <select
            value={deviceId}
            onChange={e => setDeviceId(e.target.value)}
            className="h-10 min-w-[280px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.article_number ? `${d.article_number} — ` : ''}{d.name}</option>
            ))}
          </select>
          {device && <StatusBadge value={device.release_status} />}
          {device?.ce_status && <Badge variant="outline">CE: {plmLabel(device.ce_status)}</Badge>}
          {device?.mdr_status && <Badge variant="outline">MDR: {plmLabel(device.mdr_status)}</Badge>}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Baugruppen', value: assemblies.length },
          { label: 'Stücklistenpositionen', value: bom.length },
          { label: 'Dokumente', value: docs.length, hint: expiredDocs.length ? `${expiredDocs.length} abgelaufen` : undefined },
          { label: 'Offene Änderungen', value: openChanges.length },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold">{k.value}</div>
              {k.hint && <div className="mt-1 text-xs text-destructive">{k.hint}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Freigabereife</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={readiness ? toneClass.ok : toneClass.warn}>
              {readiness ? 'Akte vollständig' : 'Offene Punkte'}
            </Badge>
          </div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>{unreleasedParts.length} nicht freigegebene Teile in der Stückliste</li>
            <li>{criticalParts.length} sicherheitsrelevante / hochkritische Teile</li>
            <li>{expiredDocs.length} abgelaufene Dokumente</li>
            <li>{openChanges.length} offene ECR/ECO</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Dokumente</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dok.-Nr.</TableHead><TableHead>Titel</TableHead><TableHead>Art</TableHead>
                <TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Gültig bis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Keine Dokumente verknüpft.</TableCell></TableRow>}
              {docs.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.document_number || '—'}</TableCell>
                  <TableCell>{d.title}</TableCell>
                  <TableCell>{plmLabel(d.doc_type)}</TableCell>
                  <TableCell>{d.version || '—'}</TableCell>
                  <TableCell><StatusBadge value={d.release_status} /></TableCell>
                  <TableCell className={d.valid_until && new Date(d.valid_until) < new Date() ? 'text-destructive' : ''}>
                    {d.valid_until ? new Date(d.valid_until).toLocaleDateString('de-DE') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Zeichnungen</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Ansicht</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {drawings.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Keine Zeichnungen.</TableCell></TableRow>}
                {drawings.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title || d.drawing_number || '—'}</TableCell>
                    <TableCell>{plmLabel(d.view_type)}</TableCell>
                    <TableCell><StatusBadge value={d.release_status || d.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Änderungen (ECR/ECO)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nr.</TableHead><TableHead>Titel</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {changes.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Keine Änderungen.</TableCell></TableRow>}
                {changes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.change_number || '—'}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell><StatusBadge value={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Produktionsaufträge</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Auftrag</TableHead><TableHead>Menge</TableHead><TableHead>Charge</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Keine Aufträge.</TableCell></TableRow>}
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number || '—'}</TableCell>
                    <TableCell>{o.quantity}</TableCell>
                    <TableCell>{o.batch_number || '—'}</TableCell>
                    <TableCell><StatusBadge value={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Arbeitsanweisungen</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>AA-Nr.</TableHead><TableHead>Titel</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {instructions.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Keine Anweisungen.</TableCell></TableRow>}
                {instructions.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.instruction_number || '—'}</TableCell>
                    <TableCell>{w.title}</TableCell>
                    <TableCell><StatusBadge value={w.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
