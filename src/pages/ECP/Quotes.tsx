import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { mockQuotes } from '@/lib/ecp/mock';

export default function EcpQuotes() {
  return (
    <div className="space-y-2">
      {mockQuotes.map((q) => (
        <Card key={q.id} className="p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium">#{q.id}</div>
            <div className="text-xs text-muted-foreground">Gültig bis: {q.valid} · {q.status}</div>
          </div>
          <div className="text-sm font-semibold">{q.total}</div>
          <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" />PDF</Button>
        </Card>
      ))}
    </div>
  );
}
