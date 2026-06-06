import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarClock, Check } from 'lucide-react';
import { toast } from 'sonner';

function isToday(d: string) {
  return d === new Date().toISOString().slice(0, 10);
}
function isPast(d: string) {
  return new Date(d) < new Date(new Date().toDateString());
}
function isThisWeek(d: string) {
  const target = new Date(d);
  const now = new Date();
  const end = new Date(now); end.setDate(now.getDate() + 7);
  return target >= new Date(now.toDateString()) && target <= end;
}

export default function Wiedervorlagen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('mail_followups').select('*').neq('status', 'erledigt').order('due_date', { ascending: true }).limit(500);
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const done = async (id: string) => {
    const { error } = await supabase.from('mail_followups').update({ status: 'erledigt' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Erledigt');
    load();
  };

  const groups = useMemo(() => ({
    overdue: items.filter(i => isPast(i.due_date) && !isToday(i.due_date)),
    today: items.filter(i => isToday(i.due_date)),
    week: items.filter(i => isThisWeek(i.due_date) && !isToday(i.due_date)),
    all: items,
  }), [items]);

  const List = ({ data }: { data: any[] }) => (
    <Card className="divide-y divide-border">
      {data.length === 0 && <div className="p-6 text-center text-muted-foreground">Keine Wiedervorlagen</div>}
      {data.map(f => (
        <div key={f.id} className="p-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{f.title}</span>
              {f.priority !== 'normal' && <Badge variant={f.priority === 'urgent' ? 'destructive' : 'secondary'}>{f.priority}</Badge>}
              {f.department && <Badge variant="outline">{f.department}</Badge>}
              {isPast(f.due_date) && !isToday(f.due_date) && <Badge variant="destructive">überfällig</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Fällig: {f.due_date}{f.note ? ` · ${f.note}` : ''}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => done(f.id)}><Check className="w-4 h-4 mr-1" />Erledigt</Button>
        </div>
      ))}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Wiedervorlagen</h2>
        <Badge variant="outline">{items.length} offen</Badge>
      </div>

      {loading && <Card className="p-6 text-center text-muted-foreground">Lade...</Card>}
      {!loading && (
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Heute ({groups.today.length})</TabsTrigger>
            <TabsTrigger value="overdue">Überfällig ({groups.overdue.length})</TabsTrigger>
            <TabsTrigger value="week">Diese Woche ({groups.week.length})</TabsTrigger>
            <TabsTrigger value="all">Alle ({groups.all.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="today"><List data={groups.today} /></TabsContent>
          <TabsContent value="overdue"><List data={groups.overdue} /></TabsContent>
          <TabsContent value="week"><List data={groups.week} /></TabsContent>
          <TabsContent value="all"><List data={groups.all} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
