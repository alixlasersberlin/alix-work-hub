import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

const MOCK = [
  { id: 'c1', name: 'Praxis Dr. Berger', city: 'München', devices: 3 },
  { id: 'c2', name: 'Klinik Nord', city: 'Hamburg', devices: 7 },
  { id: 'c3', name: 'Beauty Studio Sonne', city: 'Köln', devices: 1 },
];

export default function EmpCustomers() {
  const [q, setQ] = useState('');
  const filtered = MOCK.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kunde suchen" className="pl-9" />
      </div>
      {filtered.map((c) => (
        <Link to={`/emp/kunde/${c.id}`} key={c.id}>
          <Card className="p-3 hover:border-primary/50">
            <div className="text-sm font-medium">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.city} · {c.devices} Geräte</div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
