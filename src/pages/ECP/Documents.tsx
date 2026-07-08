import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, FileText, Search } from 'lucide-react';
import { mockDocuments } from '@/lib/ecp/mock';
import { useState } from 'react';
import { logEcp } from '@/lib/ecp/audit';
import { toast } from 'sonner';

export default function EcpDocuments() {
  const [q, setQ] = useState('');
  const items = mockDocuments.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dokumente durchsuchen" className="pl-9" />
      </div>
      {items.map((d) => (
        <Card key={d.id} className="p-3 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{d.name}</div>
            <div className="text-xs text-muted-foreground">{d.type} · {d.updated}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => { logEcp('doc_download', { id: d.id }); toast.success('Download gestartet'); }}>
            <Download className="h-4 w-4 mr-1" />PDF
          </Button>
        </Card>
      ))}
    </div>
  );
}
