import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, CalendarClock } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { suggestBestSlots, type SlotSuggestion } from '@/lib/esc/ai/engine';
import { RM_QUALIFICATIONS, RM_LOCATIONS } from '@/lib/esc/resources/mock';
import { format } from 'date-fns';

export default function AiScheduler() {
  const { appointments } = useAppointments();
  const [duration, setDuration] = useState(60);
  const [qualification, setQualification] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [slots, setSlots] = useState<SlotSuggestion[]>([]);

  const compute = () => {
    setSlots(suggestBestSlots({
      durationMinutes: duration,
      qualification: qualification || undefined,
      locationId: locationId || undefined,
      existing: appointments,
    }));
  };

  const empty = useMemo(() => slots.length === 0, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Terminassistent</h1>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Kriterien</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <Label className="text-[11px]">Dauer (Min)</Label>
            <Input type="number" value={duration} min={15} step={15} onChange={(e) => setDuration(Number(e.target.value) || 60)} />
          </div>
          <div>
            <Label className="text-[11px]">Qualifikation</Label>
            <Select value={qualification} onValueChange={setQualification}>
              <SelectTrigger><SelectValue placeholder="Beliebig" /></SelectTrigger>
              <SelectContent>
                {RM_QUALIFICATIONS.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Standort</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Beliebig" /></SelectTrigger>
              <SelectContent>
                {RM_LOCATIONS.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={compute} className="w-full"><Sparkles className="w-4 h-4 mr-1.5" />Vorschläge berechnen</Button>
          </div>
        </CardContent>
      </Card>

      {empty ? (
        <div className="text-[12.5px] text-muted-foreground">Kriterien wählen und „Vorschläge berechnen“ drücken – Alix AI schlägt bis zu 5 Zeitfenster vor.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {slots.map((s, i) => (
            <Card key={i} className="border-primary/30">
              <CardHeader className="pb-2"><CardTitle className="text-[13.5px]">{s.employeeName}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-[12.5px]">
                <div className="font-mono">{format(new Date(s.startAt), 'EEE dd.MM. HH:mm')} – {format(new Date(s.endAt), 'HH:mm')}</div>
                <div className="text-muted-foreground text-[11.5px]">{s.reason}</div>
                <div className="text-[10px] text-muted-foreground/80">Score: {s.score}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
