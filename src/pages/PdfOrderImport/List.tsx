import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Plus, Loader2, RefreshCcw, Search, X, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Hochgeladen',
  analyzing: 'Wird analysiert',
  analyzed: 'Analysiert',
  review: 'In Prüfung',
  committed: 'Importiert',
  cancelled: 'Abgebrochen',
  duplicate: 'Duplikatverdacht',
  failed: 'Fehler',
};
const STATUS_COLOR: Record<string, string> = {
  uploaded: 'bg-slate-500/20 text-slate-300',
  analyzing: 'bg-blue-500/20 text-blue-300',
  analyzed: 'bg-amber-500/20 text-amber-300',
  review: 'bg-amber-500/20 text-amber-300',
  committed: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-zinc-500/20 text-zinc-300',
  duplicate: 'bg-orange-500/20 text-orange-300',
  failed: 'bg-red-500/20 text-red-300',
};
const DOC_LABEL: Record<string, string> = {
  purchase_order: 'Auftrag',
  sales_contract: 'Kaufvertrag',
  rental_contract: 'Mietvertrag',
  leasing_contract: 'Leasing',
  order_confirmation: 'Auftragsbestätigung',
  offer: 'Angebot',
  financing_order: 'Finanzierung',
  device_order: 'Gerätebestellung',
  service_order: 'Serviceauftrag',
  other: 'Sonstiges',
};

export default function PdfOrderImportList() {
  const nav = useNavigate();
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [range, setRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    if (!toDelete) return;
    setDeleting(true);
    if (toDelete.source_storage_path) {
      await supabase.storage.from('order-imports').remove([toDelete.source_storage_path]);
    } else {
      // Pfad fehlt in Liste – nachladen
      const { data } = await supabase.from('pdf_order_imports').select('source_storage_path').eq('id', toDelete.id).maybeSingle();
      if (data?.source_storage_path) {
        await supabase.storage.from('order-imports').remove([data.source_storage_path]);
      }
    }
    const { error } = await supabase.from('pdf_order_imports').delete().eq('id', toDelete.id);
    setDeleting(false);
    if (error) { toast.error('Löschen fehlgeschlagen: ' + error.message); return; }
    toast.success('PDF-Import gelöscht');
    setToDelete(null);
    load();
  }


  async function load() {
    setLoading(true);
    let q = supabase
      .from('pdf_order_imports')
      .select('id, source_filename, document_type, status, overall_confidence, duplicate_risk, created_at, uploaded_by, created_order_id, warnings_json')
      .order('created_at', { ascending: false })
      .limit(500);
    if (range !== 'all') {
      const days = parseInt(range, 10);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      q = q.gte('created_at', since);
    }
    if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);
    if (typeFilter !== 'all') q = q.eq('document_type', typeFilter as any);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { document.title = 'PDF-Importe · Alix Work'; load(); }, [range, statusFilter, typeFilter]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      r = r.filter((x) => x.source_filename?.toLowerCase().includes(s));
    }
    if (onlyWarnings) r = r.filter((x) => Array.isArray(x.warnings_json) ? x.warnings_json.length > 0 : false);
    return r;
  }, [rows, search, onlyWarnings]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const committed = rows.filter((r) => r.status === 'committed').length;
    const review = rows.filter((r) => ['analyzed', 'review'].includes(r.status)).length;
    const failed = rows.filter((r) => ['failed', 'duplicate'].includes(r.status)).length;
    return { total, committed, review, failed };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon={FileText} title="PDF-Importe" subtitle="Hochgeladene Auftragsdokumente und Import-Entwürfe" />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="gap-2"><RefreshCcw className="w-4 h-4" /> Aktualisieren</Button>
          <Button onClick={() => nav('/auftraege/pdf-import/neu')} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
            <Plus className="w-4 h-4" /> Neuer PDF-Import
          </Button>
        </div>
      </div>

      {/* KPI Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Gesamt" value={kpi.total} />
        <KpiCard label="In Prüfung" value={kpi.review} tone="amber" />
        <KpiCard label="Importiert" value={kpi.committed} tone="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
        <KpiCard label="Fehler / Dubletten" value={kpi.failed} tone="red" icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      {/* Filterleiste */}
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input className="pl-8 pr-8 h-9" placeholder="Dateiname suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-2.5"><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Dokumenttyp" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {Object.entries(DOC_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Letzte 7 Tage</SelectItem>
              <SelectItem value="30">Letzte 30 Tage</SelectItem>
              <SelectItem value="90">Letzte 90 Tage</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={onlyWarnings} onChange={(e) => setOnlyWarnings(e.target.checked)} />
            nur mit Warnungen
          </label>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lädt …</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Keine PDF-Importe mit diesen Filtern.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Datei</th>
                  <th className="text-left p-3">Typ</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Konfidenz</th>
                  <th className="text-right p-3">Dublette</th>
                  <th className="text-left p-3">Warnungen</th>
                  <th className="text-left p-3">Hochgeladen</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const warnCount = Array.isArray(r.warnings_json) ? r.warnings_json.length : 0;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={() => nav(`/auftraege/pdf-import/${r.id}`)}>
                      <td className="p-3 font-medium truncate max-w-[280px]">{r.source_filename}</td>
                      <td className="p-3 text-xs text-muted-foreground">{DOC_LABEL[r.document_type] ?? r.document_type}</td>
                      <td className="p-3"><Badge className={STATUS_COLOR[r.status] ?? ''} variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                      <td className="p-3 text-right tabular-nums">{r.overall_confidence != null ? `${Math.round(r.overall_confidence)} %` : '—'}</td>
                      <td className="p-3 text-right tabular-nums">{r.duplicate_risk ? `${Math.round(r.duplicate_risk)} %` : '—'}</td>
                      <td className="p-3">{warnCount > 0 ? <span className="text-amber-400 text-xs">⚠ {warnCount}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="p-3 text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}</td>
                      <td className="p-3 text-right">
                        {r.status === 'analyzed' || r.status === 'review' ? (
                          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black" onClick={(e) => { e.stopPropagation(); nav(`/auftraege/pdf-import/${r.id}/review`); }}>Prüfen</Button>
                        ) : r.created_order_id ? (
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); nav(`/auftraege/${r.created_order_id}`); }}>Zum Auftrag</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); nav(`/auftraege/pdf-import/${r.id}`); }}>Öffnen</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, tone, icon }: { label: string; value: number; tone?: 'amber' | 'emerald' | 'red'; icon?: React.ReactNode }) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-400' :
    tone === 'amber' ? 'text-amber-400' :
    tone === 'red' ? 'text-red-400' : 'text-foreground';
  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-1 ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
