import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AlixDocs2Papierkorb() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('alixdocs2_documents')
      .select('id,title,nc_path,mime,size,doc_type,deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(500);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function restore(id: string) {
    const { error } = await supabase.from('alixdocs2_documents').update({ deleted_at: null }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Wiederhergestellt');
    load();
  }
  async function hardDelete(id: string) {
    if (!confirm('Endgültig löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    const { error } = await supabase.from('alixdocs2_documents').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Gelöscht');
    load();
  }

  const daysLeft = (d: string) => {
    const gone = (Date.now() - new Date(d).getTime()) / 86400000;
    return Math.max(0, Math.ceil(30 - gone));
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Trash2 className="w-6 h-6" /> Papierkorb</h1>
        <p className="text-sm text-muted-foreground">Gelöschte Dokumente werden nach 30 Tagen automatisch endgültig entfernt.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Gelöschte Dokumente ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Papierkorb ist leer.</p>}
          <div className="space-y-2">
            {items.map(d => {
              const left = daysLeft(d.deleted_at);
              return (
                <div key={d.id} className="flex items-center justify-between border rounded p-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <Link to={`/alixdocs2/dokument/${d.id}`} className="font-medium truncate block">{d.title}</Link>
                    <p className="text-xs text-muted-foreground truncate">{d.nc_path}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={left < 7 ? 'destructive' : 'outline'}>
                      {left < 7 && <AlertTriangle className="w-3 h-3 mr-1" />}
                      noch {left} Tage
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => restore(d.id)}><RotateCcw className="w-3 h-3 mr-1" /> Wiederherstellen</Button>
                    <Button size="sm" variant="destructive" onClick={() => hardDelete(d.id)}><Trash2 className="w-3 h-3 mr-1" /> Endgültig</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
