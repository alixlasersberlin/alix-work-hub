import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClipboardList, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function Gespraechsprotokolle() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('mail_phone_notes')
        .select('*')
        .not('note', 'is', null)
        .order('call_date', { ascending: false })
        .limit(300);
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = items.filter(i =>
    !search || (i.topic || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.note || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Gesprächsprotokolle</h2>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input className="pl-9" placeholder="In Gesprächsnotizen suchen..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="space-y-3">
        {loading && <Card className="p-6 text-center text-muted-foreground">Lade...</Card>}
        {!loading && filtered.length === 0 && <Card className="p-6 text-center text-muted-foreground">Keine Protokolle</Card>}
        {filtered.map(n => (
          <Card key={n.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{n.topic || '—'}</div>
              <div className="text-xs text-muted-foreground">{n.call_date} {n.call_time || ''}</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              {n.contact_name} · {n.phone_number} · {n.department || ''}
            </div>
            {n.note && <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded">{n.note}</div>}
            {n.result && <div className="text-sm mt-2"><span className="font-medium">Ergebnis: </span>{n.result}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}
