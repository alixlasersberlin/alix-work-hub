import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Award } from 'lucide-react';
import { mockTrainings } from '@/lib/ecp/mock';

export default function EcpTrainings() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {mockTrainings.map((t) => (
        <Card key={t.id} className="p-4 space-y-2">
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-muted-foreground">Datum: {t.date} · Status: {t.status}</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline"><QrCode className="h-4 w-4 mr-1" />QR-Code</Button>
            {t.certificate && <Button size="sm" variant="outline"><Award className="h-4 w-4 mr-1" />Zertifikat</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}
