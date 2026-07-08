import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';

const MOCK = [
  { id: 't1', text: 'Servicebericht Praxis Dr. Berger unterschreiben lassen', done: false },
  { id: 't2', text: 'Ersatzteil bestellen: Handstück XY-2', done: false },
  { id: 't3', text: 'Rückruf Klinik Nord', done: true },
];

export default function EmpTasks() {
  const [tasks, setTasks] = useState(MOCK);
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <Card key={t.id} className="p-3">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={t.done}
              onCheckedChange={(v) => setTasks(tasks.map(x => x.id === t.id ? { ...x, done: !!v } : x))}
              className="mt-0.5"
            />
            <span className={`text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>{t.text}</span>
          </label>
        </Card>
      ))}
    </div>
  );
}
