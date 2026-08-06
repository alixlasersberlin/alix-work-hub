import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { plmLabel } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }

const toneClass: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

function ceTone(v?: string | null) {
  if (v === 'konform' || v === 'zertifiziert') return 'ok';
  if (v === 'abgelaufen' || !v || v === 'offen') return 'bad';
  return 'warn';
}
function mdrTone(v?: string | null) {
  if (v === 'zertifiziert') return 'ok';
  if (!v || v === 'offen') return 'bad';
  if (v === 'legacy') return 'warn';
  return 'warn';
}

// Für die technische Akte nach MDR erforderliche Dokumenttypen
const REQUIRED_DOCS = ['konformitaetserklaerung', 'risikoakte', 'ifu', 'label', 'technische_doku'];

export default function PlmKonformitaet() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const [d, dc] = await Promise.all([
        supabase.from('plm_devices' as any).select('*').order('name').limit(2000),
        supabase.from('plm_documents' as any)
          .select('id,title,doc_type,device_id,release_status,valid_until').limit(5000),
      ]);
      const err = d.error || dc.error;
      if (err) toast.error(err.message);
      setDevices((d.data as any[]) || []);
      setDocs((dc.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    const today = new Date();
    const soon = new Date(today.getTime() + 60 * 86400000);
    return devices.map(dev => {
      const own = docs.filter(x => x.device_id === dev.id);
      const missing = REQUIRED_DOCS.filter(t =>
        !own.some(o => o.doc_type === t && o.release_status === 'freigegeben'));
      const expired = own.filter(o => o.valid_until && new Date(o.valid_until) < today);
      const expiring = own.filter(o => o.valid_until
        && new Date(o.valid_until) >= today && new Date(o.valid_until) <= soon);
      const ok = missing.length === 0 && expired.length === 0
        && ceTone(dev.ce_status) === 'ok' && mdrTone(dev.mdr_status) === 'ok' && !!dev.udi_di;
      return { dev, own, missing, expired, expiring, ok };
    });
  }, [devices, docs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.dev.name, r.dev.article_number, r.dev.product_family, r.dev.udi_di, r.dev.mdr_class]
        .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(s)));
  }, [rows, q]);

  const kpi = useMemo(() => ({
    total: rows.length,
    conform: rows.filter(r => r.ok).length,
    missingDocs: rows.filter(r => r.missing.length > 0).length,
    expired: rows.filter(r => r.expired.length > 0).length,
    noUdi: rows.filter(r => !r.dev.udi_di).length,
  }), [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade Konformitätsdaten…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konformität (CE / MDR)"
        description="Regulatorischer Status je Gerät inkl. Pflichtdokumenten, Ablaufdaten und UDI."
        icon={ShieldCheck}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { l: 'Geräte', v: kpi.total, t: 'muted' },
          { l: 'Vollständig konform', v: kpi.conform, t: 'ok' },
          { l: 'Pflichtdokumente fehlen', v: kpi.missingDocs, t: 'bad' },
          { l: 'Abgelaufene Dokumente', v: kpi.expired, t: 'bad' },
          { l: 'Ohne UDI-DI', v: kpi.noUdi, t: 'warn' },
        ].map(k => (
          <Card key={k.l}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{k.l}</CardTitle></CardHeader>
            <CardContent>
              <span className={`text-2xl font-semibold ${k.t === 'ok' ? 'text-emerald-500' : k.t === 'bad' ? 'text-destructive' : k.t === 'warn' ? 'text-amber-500' : ''}`}>{k.v}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Input
        placeholder="Suche nach Gerät, Artikelnummer, Produktfamilie, UDI-DI oder MDR-Klasse…"
        value={q}
        onChange={e => setQ(e.target.value)}
        className="max-w-xl"
      />

      <Card>
        <CardHeader><CardTitle>Konformitätsmatrix</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gerät</TableHead>
                <TableHead>Artikelnr.</TableHead>
                <TableHead>CE</TableHead>
                <TableHead>MDR</TableHead>
                <TableHead>Klasse</TableHead>
                <TableHead>UDI-DI</TableHead>
                <TableHead>Fehlende Pflichtdokumente</TableHead>
                <TableHead className="text-right">Abgelaufen</TableHead>
                <TableHead className="text-right">Läuft ab (60 T.)</TableHead>
                <TableHead>Bewertung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.dev.id}>
                  <TableCell className="font-medium">{r.dev.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.dev.article_number || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={toneClass[ceTone(r.dev.ce_status)]}>{plmLabel(r.dev.ce_status)}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={toneClass[mdrTone(r.dev.mdr_status)]}>{plmLabel(r.dev.mdr_status)}</Badge></TableCell>
                  <TableCell>{r.dev.mdr_class || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.dev.udi_di || <span className="text-destructive">fehlt</span>}</TableCell>
                  <TableCell className="text-xs">
                    {r.missing.length === 0
                      ? <span className="text-emerald-500">vollständig</span>
                      : r.missing.map(m => plmLabel(m)).join(', ')}
                  </TableCell>
                  <TableCell className="text-right">{r.expired.length || '—'}</TableCell>
                  <TableCell className="text-right">{r.expiring.length || '—'}</TableCell>
                  <TableCell>
                    {r.ok
                      ? <Badge variant="outline" className={toneClass.ok}>konform</Badge>
                      : <Badge variant="outline" className={toneClass.bad}><AlertTriangle className="h-3 w-3 mr-1" />Maßnahme nötig</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Keine Geräte gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
