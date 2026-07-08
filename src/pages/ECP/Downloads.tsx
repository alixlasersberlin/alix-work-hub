import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { mockDownloads } from '@/lib/ecp/mock';
import { logEcp } from '@/lib/ecp/audit';
import { toast } from 'sonner';

export default function EcpDownloads() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {mockDownloads.map((d) => (
        <Card key={d.id} className="p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium">{d.name}</div>
            <div className="text-xs text-muted-foreground">{d.size}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => { logEcp('download', { id: d.id }); toast.success('Download gestartet'); }}>
            <Download className="h-4 w-4 mr-1" />Herunterladen
          </Button>
        </Card>
      ))}
    </div>
  );
}
