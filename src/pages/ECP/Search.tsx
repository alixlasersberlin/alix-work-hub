import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { mockDevices, mockDocuments, mockInvoices, mockQuotes, mockTickets, mockAppointments, mockTrainings } from '@/lib/ecp/mock';

type Result = { section: string; text: string };

export default function EcpSearch() {
  const [q, setQ] = useState('');
  const results = useMemo<Result[]>(() => {
    if (!q.trim()) return [];
    const t = q.toLowerCase();
    const out: Result[] = [];
    mockDevices.forEach((d) => { if ((d.model + d.serial + d.location).toLowerCase().includes(t)) out.push({ section: 'Geräte', text: `${d.model} · ${d.serial}` }); });
    mockDocuments.forEach((d) => { if (d.name.toLowerCase().includes(t)) out.push({ section: 'Dokumente', text: d.name }); });
    mockInvoices.forEach((i) => { if (i.id.toLowerCase().includes(t)) out.push({ section: 'Rechnungen', text: i.id }); });
    mockQuotes.forEach((qq) => { if (qq.id.toLowerCase().includes(t)) out.push({ section: 'Angebote', text: qq.id }); });
    mockTickets.forEach((tk) => { if (tk.subject.toLowerCase().includes(t)) out.push({ section: 'Tickets', text: tk.subject }); });
    mockAppointments.forEach((a) => { if (a.title.toLowerCase().includes(t)) out.push({ section: 'Termine', text: a.title }); });
    mockTrainings.forEach((s) => { if (s.title.toLowerCase().includes(t)) out.push({ section: 'Schulungen', text: s.title }); });
    return out;
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Global suchen (Geräte, Dokumente, Tickets, …)" className="pl-9" />
      </div>
      {results.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">Keine Treffer – oder Suche starten.</Card>
      ) : (
        <div className="space-y-2">
          {results.map((r, idx) => (
            <Card key={idx} className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.section}</div>
              <div className="text-sm">{r.text}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
