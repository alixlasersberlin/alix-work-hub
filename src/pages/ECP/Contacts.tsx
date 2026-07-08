import { Card } from '@/components/ui/card';
import { mockContacts } from '@/lib/ecp/mock';

export default function EcpContacts() {
  return (
    <div className="space-y-2">
      {mockContacts.map((c) => (
        <Card key={c.id} className="p-3">
          <div className="text-sm font-semibold">{c.name}</div>
          <div className="text-xs text-muted-foreground">{c.role} · {c.email}</div>
        </Card>
      ))}
      <Card className="p-3 text-xs text-muted-foreground">Berechtigungen pro Ansprechpartner werden durch den Administrator verwaltet.</Card>
    </div>
  );
}
