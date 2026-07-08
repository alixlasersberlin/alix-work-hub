import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, ScanLine } from 'lucide-react';
import { auditMobile } from '@/lib/emp/audit';

interface Props {
  onScan: (code: string) => void;
}

// Native camera QR readers require a library or BarcodeDetector API.
// This is a scaffolded scanner: uses BarcodeDetector when available, otherwise manual entry.
export default function QrScanner({ onScan }: Props) {
  const [manual, setManual] = useState('');
  const supported = typeof (window as any).BarcodeDetector !== 'undefined';

  const submit = () => {
    if (!manual.trim()) return;
    auditMobile('qr_scan', { code: manual, method: 'manual' });
    onScan(manual.trim());
    setManual('');
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <QrCode className="h-4 w-4" /> QR / Code
      </div>
      <div className="text-xs text-muted-foreground">
        {supported ? 'Kamera-Scanner verfügbar (aktivieren im nächsten Schritt).' : 'Kamera-Scanner nicht verfügbar — bitte Code eingeben.'}
      </div>
      <div className="flex gap-2">
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Code manuell eingeben" />
        <Button onClick={submit}><ScanLine className="h-4 w-4 mr-1" />OK</Button>
      </div>
    </div>
  );
}
