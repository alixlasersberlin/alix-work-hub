import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Plus, Loader2, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';

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

export default function PdfOrderImportList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('pdf_order_imports')
      .select('id, source_filename, document_type, status, overall_confidence, duplicate_risk, created_at, uploaded_by, created_order_id')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { document.title = 'PDF-Importe · Alix Work'; load(); }, []);

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

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lädt …</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Noch keine PDF-Importe.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Datei</th>
                  <th className="text-left p-3">Typ</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Konfidenz</th>
                  <th className="text-right p-3">Dublette</th>
                  <th className="text-left p-3">Hochgeladen</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={() => nav(`/auftraege/pdf-import/${r.id}`)}>
                    <td className="p-3 font-medium truncate max-w-[280px]">{r.source_filename}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.document_type}</td>
                    <td className="p-3">
                      <Badge className={STATUS_COLOR[r.status] ?? ''} variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.overall_confidence != null ? `${Math.round(r.overall_confidence)} %` : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{r.duplicate_risk ? `${Math.round(r.duplicate_risk)} %` : '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); nav(`/auftraege/pdf-import/${r.id}`); }}>Öffnen</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
