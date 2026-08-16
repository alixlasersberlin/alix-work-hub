import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Globe, AlertTriangle, ShieldCheck, Image as ImageIcon, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { phTone, PH_CRITICAL_FIELDS, phLabel } from '@/lib/producthub/config';

const db = supabase as any;

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${tone || ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default function ProductHubDashboard() {
  const [k, setK] = useState<any>(null);
  const [changes, setChanges] = useState<any[]>([]);
  const [syncErrors, setSyncErrors] = useState<any[]>([]);
  const [phase, setPhase] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: media }, { data: docs }, { data: conf }, { data: hist }, { data: logs }, { data: st }] =
        await Promise.all([
          db.from('ph_products').select('*'),
          db.from('ph_media').select('product_id'),
          db.from('ph_documents').select('product_id'),
          db.from('ph_conflicts').select('product_id').is('resolved_at', null),
          db.from('ph_field_history').select('*').order('created_at', { ascending: false }).limit(15),
          db.from('ph_sync_log').select('*').eq('status', 'error').order('created_at', { ascending: false }).limit(10),
          db.from('ph_settings').select('*').eq('key', 'migration_phase').maybeSingle(),
        ]);
      const mediaMap: Record<string, number> = {};
      (media || []).forEach((m: any) => { mediaMap[m.product_id] = (mediaMap[m.product_id] || 0) + 1; });
      const docMap: Record<string, number> = {};
      (docs || []).forEach((m: any) => { docMap[m.product_id] = (docMap[m.product_id] || 0) + 1; });
      const confMap: Record<string, number> = {};
      (conf || []).forEach((m: any) => { confMap[m.product_id] = (confMap[m.product_id] || 0) + 1; });
      const list = prods || [];
      const tones = list.map((p: any) => phTone(p, {
        conflicts: confMap[p.id], media: mediaMap[p.id], documents: docMap[p.id],
      }).tone);
      setK({
        total: list.length,
        de: list.filter((p: any) => p.active_de).length,
        com: list.filter((p: any) => p.active_com).length,
        complete: tones.filter(t => t === 'green').length,
        review: tones.filter(t => t === 'amber').length,
        conflicts: Object.keys(confMap).length,
        regulatory: list.filter((p: any) => !p.mdr_status || !p.ce_status).length,
        noMedia: list.filter((p: any) => !mediaMap[p.id]).length,
        noDocs: list.filter((p: any) => !docMap[p.id]).length,
        syncErrors: (logs || []).length,
      });
      setChanges(hist || []);
      setSyncErrors(logs || []);
      setPhase(st?.value || null);
    })();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader title="Product Hub" subtitle="Zentrales Master-System für alle ALIX Geräte und Produktdaten" icon={Boxes} />

      {phase && (
        <Card className="border-primary/30">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-primary/40 text-primary">Migrationsphase {phase.phase}</Badge>
            <span className="text-sm text-muted-foreground">
              {phase.phase === 'A' && 'COM → DE Sync aktiv · AlixWork wird aufgebaut'}
              {phase.phase === 'B' && 'AlixWork parallel · Validierung gegen COM/DE'}
              {phase.phase === 'C' && 'AlixWork ist Master → COM + DE'}
            </span>
            <Link to="/product-hub/einstellungen" className="text-sm text-primary hover:underline ml-auto">Einstellungen</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Gesamtgeräte" value={k?.total ?? '–'} />
        <Kpi label="Online DE" value={k?.de ?? '–'} />
        <Kpi label="Online COM" value={k?.com ?? '–'} />
        <Kpi label="Vollständig" value={k?.complete ?? '–'} tone="text-emerald-500" />
        <Kpi label="Review erforderlich" value={k?.review ?? '–'} tone="text-amber-500" />
        <Kpi label="Konflikte" value={k?.conflicts ?? '–'} tone="text-destructive" />
        <Kpi label="Regulatory Review" value={k?.regulatory ?? '–'} tone="text-amber-500" />
        <Kpi label="Fehlende Medien" value={k?.noMedia ?? '–'} />
        <Kpi label="Fehlende Dokumente" value={k?.noDocs ?? '–'} />
        <Kpi label="Sync Fehler" value={k?.syncErrors ?? '–'} tone="text-destructive" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Letzte Änderungen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {changes.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Änderungen.</div>}
            {changes.map(c => (
              <div key={c.id} className="text-sm flex items-start gap-2 border-b border-border/50 pb-1.5">
                {PH_CRITICAL_FIELDS.includes(c.field_name)
                  ? <ShieldCheck className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                  : <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{phLabel(c.field_name)}: <span className="text-muted-foreground line-through">{c.old_value ?? '—'}</span> → <span className="text-foreground">{c.new_value ?? '—'}</span></div>
                  <div className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString('de-DE')}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Sync-Fehler</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {syncErrors.length === 0 && <div className="text-sm text-muted-foreground">Keine Sync-Fehler.</div>}
            {syncErrors.map(l => (
              <div key={l.id} className="text-sm">
                <Badge variant="outline" className="mr-2">{l.channel_code || '—'}</Badge>
                {l.message}
                <div className="text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleString('de-DE')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Link to="/product-hub/geraete"><Card className="hover:border-primary/40 transition-colors"><CardContent className="p-4 flex items-center gap-3"><Boxes className="w-5 h-5 text-primary" /> Geräte verwalten</CardContent></Card></Link>
        <Link to="/product-hub/webseiten"><Card className="hover:border-primary/40 transition-colors"><CardContent className="p-4 flex items-center gap-3"><Globe className="w-5 h-5 text-primary" /> Webseiten & Veröffentlichung</CardContent></Card></Link>
        <Link to="/product-hub/konflikte"><Card className="hover:border-primary/40 transition-colors"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-primary" /> Konflikte prüfen</CardContent></Card></Link>
      </div>
    </div>
  );
}
