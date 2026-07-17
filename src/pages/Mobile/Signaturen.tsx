import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSignature, QrCode, Loader2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MobileSignaturen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'today' | 'all'>('open');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('sig_requests').select('id, status, created_at, sig_documents(title, document_type)').order('created_at', { ascending: false }).limit(50);
    if (tab === 'open') q = q.in('status', ['versendet', 'neu', 'geoeffnet', 'in_bearbeitung', 'teilweise_signiert']);
    if (tab === 'today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      q = q.gte('created_at', start.toISOString());
    }
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab]);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display gold-text flex items-center gap-2"><FileSignature className="w-5 h-5" /> Signaturen</h1>
        <Button size="sm" variant="outline" asChild><Link to="/signaturen/neu"><QrCode className="w-4 h-4 mr-1" /> Scan</Link></Button>
      </div>
      <div className="grid grid-cols-3 gap-1 bg-muted rounded-lg p-1 text-xs">
        {(['open', 'today', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`py-1.5 rounded ${tab === t ? 'bg-background shadow-sm font-medium' : ''}`}>
            {t === 'open' ? 'Offen' : t === 'today' ? 'Heute' : 'Alle'}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">Keine Signaturen.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} to={`/sign/${r.id}`}>
              <Card className="p-3 flex items-center gap-3 active:bg-muted">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.sig_documents?.title ?? 'Unbenannt'}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</div>
                </div>
                <Badge variant={r.status === 'signiert' ? 'default' : 'secondary'} className="text-[10px]">{r.status}</Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
