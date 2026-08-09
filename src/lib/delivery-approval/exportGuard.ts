import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { assertOrderReleased, fetchReleaseStatusByOrderNumbers } from './api';
import { STAGES } from './config';

const db = supabase as any;

export interface ExportGuardParams {
  orderId?: string | null;
  /** Alternative: Auftragsnummer(n), z. B. aus Termintiteln extrahiert. */
  orderNumbers?: string[];
  isSuperAdmin?: boolean;
  userId?: string | null;
  userName?: string | null;
  /** Kontext für das Audit-Log, z. B. "Lieferschein-PDF". */
  context: string;
}

async function resolveOrderId(p: ExportGuardParams): Promise<string | null> {
  if (p.orderId) return p.orderId;
  const nums = (p.orderNumbers ?? []).filter(Boolean);
  if (!nums.length) return null;
  const { data } = await db.from('orders').select('id').in('order_number', nums).limit(1);
  return (data?.[0]?.id as string) ?? null;
}

/**
 * Harte Sperre vor jedem Lieferschein-/Übergabe-Export.
 * Gibt `true` zurück, wenn der Export erlaubt ist. Ein Super Admin kann mit
 * Begründung (min. 5 Zeichen) übersteuern – dies wird revisionssicher protokolliert.
 */
export async function guardDeliveryExport(p: ExportGuardParams): Promise<boolean> {
  const orderId = await resolveOrderId(p);

  if (!orderId) {
    // Keine Auftragszuordnung möglich → Export nur mit Freigabe-Prüfung erlaubt,
    // wenn eine Nummer angegeben war (dann ist der Auftrag unbekannt = gesperrt).
    if ((p.orderNumbers ?? []).length) {
      toast.error(`${p.context} gesperrt: Auftrag zur Freigabeprüfung nicht auffindbar.`);
      return false;
    }
    return true;
  }

  const first = await assertOrderReleased({ orderId, context: p.context });
  if (first.allowed) return true;

  const missing = first.missing.length ? first.missing : STAGES.map((s) => s.title);

  if (!p.isSuperAdmin) {
    toast.error(`${p.context} gesperrt – keine Auslieferungsfreigabe.`, {
      description: `Fehlend: ${missing.join(', ')}`,
    });
    return false;
  }

  const reason = window.prompt(
    `Keine vollständige Auslieferungsfreigabe (fehlend: ${missing.join(', ')}).\n` +
      `Bitte Begründung für die Übersteuerung eingeben (min. 5 Zeichen):`,
    '',
  );
  if (!reason || reason.trim().length < 5) {
    toast.error(`${p.context} abgebrochen – keine gültige Begründung.`);
    return false;
  }

  const res = await assertOrderReleased({
    orderId,
    isSuperAdmin: true,
    overrideReason: reason,
    userId: p.userId ?? null,
    userName: p.userName ?? 'Super Admin',
    context: p.context,
  });
  if (!res.allowed) {
    toast.error(`${p.context} gesperrt – Übersteuerung nicht möglich.`);
    return false;
  }
  toast.warning(`${p.context}: Sperre als Super Admin übersteuert (protokolliert).`);
  return true;
}

/** Prüft nur den Status anhand von Auftragsnummern (ohne Übersteuerung). */
export async function isReleasedByOrderNumbers(numbers: string[]): Promise<boolean> {
  if (!numbers.length) return true;
  const map = await fetchReleaseStatusByOrderNumbers(numbers);
  return numbers.every((n) => ['released', 'delivered', 'completed'].includes(map[n] as string));
}
