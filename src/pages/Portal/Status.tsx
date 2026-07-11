import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { Card, CardContent } from '@/components/ui/card';

interface StatusPayload {
  ok: true;
  order_number: string;
  status_code: number;
  status_label: string;
  status_text: string;
  expected_delivery: string | null;
  tracking_number: string | null;
  customer_name: string | null;
}

const STEPS = [
  { code: 1, label: 'Anzahlung' },
  { code: 2, label: 'Eingegangen' },
  { code: 4, label: 'Bestätigt' },
  { code: 5, label: 'Produktion' },
  { code: 7, label: 'Versand' },
  { code: 9, label: 'Geliefert' },
];

export default function PortalStatus() {
  const navigate = useNavigate();
  const [data, setData] = useState<StatusPayload | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('alix_portal_status');
    if (!raw) { navigate('/portal', { replace: true }); return; }
    try { setData(JSON.parse(raw)); } catch { navigate('/portal', { replace: true }); }
  }, [navigate]);

  if (!data) return null;

  const currentIdx = STEPS.findIndex(s => s.code >= data.status_code);
  const reached = (idx: number) => currentIdx === -1 ? true : idx <= currentIdx;
  const isNeedsInfo = data.status_code === 10;

  return (
    <BookingLayout hideLegalLinks narrow step={2} totalSteps={2}>
      <div className="mb-2 text-sm text-muted-foreground">Auftragsnummer</div>
      <div className="text-2xl font-semibold tracking-tight mb-1">{data.order_number}</div>
      {data.customer_name && <div className="text-sm text-muted-foreground mb-4">{data.customer_name}</div>}

      <Card className={isNeedsInfo ? 'border-amber-300' : 'border-primary/30'}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-primary-foreground ${isNeedsInfo ? 'bg-amber-500' : 'bg-primary'}`}>
              {isNeedsInfo ? <Package className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aktueller Status</div>
              <div className="text-lg font-semibold mt-0.5">{data.status_label}</div>
              <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{data.status_text}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNeedsInfo && (
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Bearbeitungsfortschritt</div>
            <div className="flex items-center justify-between gap-1">
              {STEPS.map((s, i) => (
                <div key={s.code} className="flex-1 flex flex-col items-center text-center">
                  <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${reached(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  <div className={`text-[10px] sm:text-xs mt-2 ${reached(i) ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(data.expected_delivery || data.tracking_number) && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {data.expected_delivery && (
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-foreground/70 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Voraussichtlicher Liefertermin</div>
                  <div className="font-medium">{format(new Date(data.expected_delivery), 'dd. MMMM yyyy', { locale: de })}</div>
                </div>
              </div>
            )}
            {data.tracking_number && (
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-foreground/70 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Trackingnummer</div>
                  <div className="font-mono text-sm">{data.tracking_number}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-center pt-2">
        <Button onClick={() => navigate('/portal')} variant="outline">
          Neue Abfrage starten
        </Button>
      </div>
    </BookingLayout>
  );
}
