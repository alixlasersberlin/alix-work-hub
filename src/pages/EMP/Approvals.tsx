import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Item { id: string; type: string; text: string; amount?: string; }
const MOCK: Item[] = [
  { id: 'g1', type: 'Urlaub', text: 'Meier · 12.–19.07.2026' },
  { id: 'g2', type: 'Auftrag', text: 'Sonderkonditionen Klinik Nord', amount: '18.400 €' },
  { id: 'g3', type: 'Schulung', text: 'Externe Weiterbildung Berger' },
];

export default function EmpApprovals() {
  const [items, setItems] = useState(MOCK);
  const decide = (id: string, ok: boolean) => {
    setItems(items.filter(i => i.id !== id));
    toast.success(ok ? 'Freigegeben' : 'Abgelehnt');
  };
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <Card key={i.id} className="p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.type}</div>
          <div className="text-sm">{i.text}</div>
          {i.amount && <div className="text-xs text-muted-foreground">Betrag: {i.amount}</div>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(i.id, true)}><Check className="h-4 w-4 mr-1" />Freigeben</Button>
            <Button size="sm" variant="outline" onClick={() => decide(i.id, false)}><X className="h-4 w-4 mr-1" />Ablehnen</Button>
          </div>
        </Card>
      ))}
      {items.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Keine offenen Freigaben</Card>}
    </div>
  );
}
