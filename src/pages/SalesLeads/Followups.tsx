import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Followup = {
  id: string;
  lead_id: string | null;
  type: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: string;
  done_at: string | null;
  created_at: string;
};

export default function SalesFollowups() {
  const [rows, setRows] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('sales_followups')
      .select('*')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(500);
    setRows((data ?? []) as Followup[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

  const groups = useMemo(() => {
    const offen: Followup[] = [];
    const heute: Followup[] = [];
    const ueberfaellig: Followup[] = [];
    const erledigt: Followup[] = [];
    for (const r of rows) {
      if (r.status === 'erledigt') { erledigt.push(r); continue; }
      offen.push(r);
      if (r.due_at) {
        const t = new Date(r.due_at).getTime();
        if (t < startOfToday.getTime()) ueberfaellig.push(r);
        else if (t <= endOfToday.getTime()) heute.push(r);
      }
    }
    return { offen, heute, ueberfaellig, erledigt };
  }, [rows, now]);

  async function markDone(id: string) {
    const { error } = await supabase.from('sales_followups').update({
      status: 'erledigt', done_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Erledigt');
    load();
  }

  function renderList(list: Followup[]) {
    if (loading) return <p className="p-4 text-muted-foreground">Lade …</p>;
    if (list.length === 0) return <p className="p-4 text-muted-foreground">Keine Einträge.</p>;
    return (
      <ul className="divide-y">
        {list.map((r) => (
          <li key={r.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">
                {r.type}: {r.title}
                {r.lead_id && (
                  <Link to={`/verkauf/anfragen/${r.lead_id}`} className="ml-2 text-xs text-primary underline">Zur Anfrage</Link>
                )}
              </div>
              {r.description && <div className="text-sm text-muted-foreground">{r.description}</div>}
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {r.due_at ? new Date(r.due_at).toLocaleString('de-DE') : 'Keine Fälligkeit'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.status === 'erledigt' ? 'secondary' : 'outline'}>{r.status}</Badge>
              {r.status !== 'erledigt' && (
                <Button size="sm" variant="outline" onClick={() => markDone(r.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Erledigt
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nachfassen</h1>
        <p className="text-sm text-muted-foreground">Vertriebsaufgaben aus Anfragen und Angeboten</p>
      </div>
      <Card>
        <Tabs defaultValue="offen">
          <TabsList className="m-3">
            <TabsTrigger value="offen">Offen ({groups.offen.length})</TabsTrigger>
            <TabsTrigger value="heute">Heute ({groups.heute.length})</TabsTrigger>
            <TabsTrigger value="ueberfaellig">Überfällig ({groups.ueberfaellig.length})</TabsTrigger>
            <TabsTrigger value="erledigt">Erledigt ({groups.erledigt.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="offen">{renderList(groups.offen)}</TabsContent>
          <TabsContent value="heute">{renderList(groups.heute)}</TabsContent>
          <TabsContent value="ueberfaellig">{renderList(groups.ueberfaellig)}</TabsContent>
          <TabsContent value="erledigt">{renderList(groups.erledigt)}</TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
