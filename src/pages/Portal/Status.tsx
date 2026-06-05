import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-display font-bold text-lg">A</div>
            <div>
              <div className="font-display font-bold text-lg leading-none">Alix Lasers</div>
              <div className="text-xs text-slate-500 mt-0.5">Kundenportal · Bestellstatus</div>
            </div>
          </div>
          <Link to="/portal" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Neue Abfrage
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-2 text-sm text-slate-500">Auftragsnummer</div>
          <div className="text-2xl font-display font-bold mb-1">{data.order_number}</div>
          {data.customer_name && <div className="text-sm text-slate-600 mb-6">{data.customer_name}</div>}

          <div className={`rounded-2xl border p-6 mb-6 ${isNeedsInfo ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isNeedsInfo ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                {isNeedsInfo ? <Package className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Aktueller Status</div>
                <div className="text-lg font-display font-bold text-slate-900 mt-0.5">{data.status_label}</div>
                <p className="text-sm text-slate-700 mt-2 leading-relaxed">{data.status_text}</p>
              </div>
            </div>
          </div>

          {!isNeedsInfo && (
            <div className="rounded-2xl border border-slate-200 p-6 mb-6">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">Bearbeitungsfortschritt</div>
              <div className="flex items-center justify-between gap-1">
                {STEPS.map((s, i) => (
                  <div key={s.code} className="flex-1 flex flex-col items-center text-center">
                    <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${reached(i) ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <div className={`text-[10px] sm:text-xs mt-2 ${reached(i) ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{s.label}</div>
                    {i < STEPS.length - 1 && <div className={`h-0.5 w-full mt-3 -mb-5 ${reached(i + 1) ? 'bg-slate-900' : 'bg-slate-200'}`} style={{ marginTop: '-14px', position: 'relative', top: '-18px', zIndex: -1 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data.expected_delivery || data.tracking_number) && (
            <div className="rounded-2xl border border-slate-200 p-6 space-y-3">
              {data.expected_delivery && (
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-slate-700 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-500">Voraussichtlicher Liefertermin</div>
                    <div className="font-medium text-slate-900">{format(new Date(data.expected_delivery), 'dd. MMMM yyyy', { locale: de })}</div>
                  </div>
                </div>
              )}
              {data.tracking_number && (
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-slate-700 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-500">Trackingnummer</div>
                    <div className="font-mono text-sm text-slate-900">{data.tracking_number}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 text-center">
            <Button onClick={() => navigate('/portal')} variant="outline" className="text-slate-700 border-slate-300">
              Neue Abfrage starten
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Alix Lasers GmbH
        </div>
      </footer>
    </div>
  );
}
