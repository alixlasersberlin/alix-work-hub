import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { mockInvoices } from '@/lib/ecp/mock';

export default function EcpInvoices() {
  return (
    <div className="space-y-2">
      {mockInvoices.map((i) => (
        <Card key={i.id} className="p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium">#{i.id}</div>
            <div className="text-xs text-muted-foreground">Fällig: {i.due} · Status: {i.status}</div>
          </div>
          <div className="text-sm font-semibold">{i.total}</div>
          <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" />PDF</Button>
        </Card>
      ))}
    </div>
  );
}
