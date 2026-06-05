import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

// Reminder erscheint für ALLE eingeloggten User.

const REMINDER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000; // 14 Tage
const TRIGGER_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

type OverdueDevice = {
  id: string;
  serial_number: string;
  model_name: string;
  customer: string | null;
  leihstart: string | null;
  daysOut: number;
};

function parseLeihstart(notes: string | null | undefined): string | null {
  const m = /\[Leihstart:\s*([^\]]+)\]/.exec(notes ?? '');
  return m?.[1]?.trim() || null;
}

function parseKunde(notes: string | null | undefined): string | null {
  const m = /\[Kunde:\s*([^\]]+)\]/.exec(notes ?? '');
  return m?.[1]?.split('|')[0]?.trim() || null;
}

function isLeih(notes: string | null | undefined): boolean {
  return /\[Typ:\s*Leihgerät\]|\[Leihgerät\]/.test(notes ?? '');
}

export default function LeihgeraetReminder() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<OverdueDevice[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    // Erzwungener Test-Trigger beim nächsten Login für Justin & Natalia (einmalig)
    const first = (profile.full_name ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const isForceTarget = first === 'justin' || first === 'natalia';
    const forceKey = `leih_reminder_force_test_v1_${user.id}`;
    const forceTest = isForceTarget && !localStorage.getItem(forceKey);

    const storageKey = `leih_reminder_last_${user.id}`;
    const last = Number(localStorage.getItem(storageKey) || '0');
    const now = Date.now();
    if (!forceTest && last && now - last < REMINDER_INTERVAL_MS) return;

    (async () => {
      const { data } = await supabase
        .from('lager_devices')
        .select('id, serial_number, model_name, notes, entry_date')
        .limit(2000);

      const overdue: OverdueDevice[] = [];
      for (const d of (data ?? []) as any[]) {
        if (!isLeih(d.notes)) continue;
        const startStr = parseLeihstart(d.notes);
        const customer = parseKunde(d.notes);
        if (!customer) continue; // nur Geräte, die wirklich beim Kunden sind
        if (!startStr) continue;
        const start = new Date(startStr).getTime();
        if (!Number.isFinite(start)) continue;
        const diff = now - start;
        if (!forceTest && diff < TRIGGER_AFTER_MS) continue;
        overdue.push({
          id: d.id,
          serial_number: d.serial_number,
          model_name: d.model_name,
          customer,
          leihstart: startStr,
          daysOut: Math.floor(diff / (24 * 60 * 60 * 1000)),
        });
      }

      if (overdue.length > 0) {
        if (forceTest) localStorage.setItem(forceKey, String(now));
        setDevices(overdue);
        setOpen(true);
      }
    })();
  }, [user, profile]);


  if (!open) return null;

  const dismiss = () => {
    if (user) localStorage.setItem(`leih_reminder_last_${user.id}`, String(Date.now()));
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl border-4 border-red-500 bg-gradient-to-br from-red-600 to-red-800 shadow-2xl shadow-red-900/50 text-white">
        {/* Faust, die aus dem Fenster herausschaut */}
        <div
          className="absolute -top-20 -right-10 text-[160px] leading-none select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] rotate-[20deg]"
          aria-hidden
        >
          👊
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 text-white/70 hover:text-white"
          aria-label="Schließen"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="px-8 pt-10 pb-8 space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-10 h-10 text-yellow-300" />
            <h2 className="text-4xl md:text-5xl font-black tracking-tight uppercase">
              Leihgerät zurückholen
            </h2>
          </div>

          <p className="text-lg text-white/90">
            Folgende Leihgeräte sind seit mehr als 30 Tagen beim Kunden.
            Bitte umgehend Rückholung organisieren. Erinnerung erscheint alle 14 Tage erneut.
          </p>

          <div className="max-h-64 overflow-y-auto rounded-lg bg-red-950/40 border border-red-400/40 divide-y divide-red-400/30">
            {devices.map((d) => (
              <div key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono font-bold">{d.serial_number}</span>
                <span className="opacity-90">{d.model_name}</span>
                <span className="ml-auto text-yellow-300 font-semibold">{d.daysOut} Tage</span>
                <span className="basis-full text-white/80 text-xs">
                  Kunde: <strong>{d.customer}</strong> · Leihstart: {d.leihstart}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={dismiss}
              className="bg-white text-red-700 hover:bg-white/90 font-bold uppercase tracking-wide"
            >
              Verstanden – in 14 Tagen erneut anzeigen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
