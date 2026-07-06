import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { notifyBus } from './useNotifications';
import { useAuth } from './useAuth';

const SEEN_KEY = 'alixwork.notifications.seen.v1';
const POLL_MS = 60_000;

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.slice(-500) : []);
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-500)));
  } catch {/* noop */}
}

/**
 * Polls a few key tables and pushes actionable events into the NotificationCenter.
 * Dedupes via a localStorage "seen" set so each event only fires once per device.
 * Only runs for roles that can act on the events (Super Admin / Admin / QM).
 */
export function useNotificationFeed() {
  const { user, roles } = useAuth();
  const location = useLocation();
  const timer = useRef<number | null>(null);
  const seenRef = useRef<Set<string>>(loadSeen());

  useEffect(() => {
    if (!user) return;
    const isAdmin = roles.includes('Super Admin') || roles.includes('Admin');
    const isFinance = isAdmin || roles.includes('Finance');
    const isTicketUser = isAdmin || roles.includes('Order') || roles.includes('QM');
    if (!isAdmin && !isFinance && !isTicketUser) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const seen = seenRef.current;
      const tasks: Promise<void>[] = [];

      // 1) Pending production-order approvals (Super Admin only)
      if (roles.includes('Super Admin')) {
        tasks.push((async () => {
          const { data } = await supabase
            .from('production_orders' as any)
            .select('id, order_number, created_at')
            .eq('approval_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(10);
          (data ?? []).forEach((r: any) => {
            const key = `prod-approval:${r.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            notifyBus.push({
              title: 'Bestellung wartet auf Freigabe',
              body: `Auftrag ${r.order_number ?? r.id}`,
              kind: 'warning',
              module: 'Production',
              href: '/production',
            });
          });
        })());
      }

      // 2) Finance reminders in draft (Finance + Admin)
      if (isFinance) {
        tasks.push((async () => {
          const { data } = await supabase
            .from('finance_reminders' as any)
            .select('id, level, customer_name, created_at')
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .limit(10);
          (data ?? []).forEach((r: any) => {
            const key = `reminder:${r.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            notifyBus.push({
              title: `Mahnung Stufe ${r.level ?? '–'} erstellt`,
              body: r.customer_name ?? 'Entwurf bereit zum Versand',
              kind: 'info',
              module: 'Mahnwesen',
              href: '/finance/mahnwesen',
            });
          });
        })());
      }

      // 3) New / open tickets (Order, Admin, QM)
      if (isTicketUser) {
        tasks.push((async () => {
          const { data } = await supabase
            .from('tickets' as any)
            .select('id, subject, status, created_at')
            .in('status', ['new', 'open'])
            .order('created_at', { ascending: false })
            .limit(10);
          (data ?? []).forEach((r: any) => {
            const key = `ticket:${r.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            notifyBus.push({
              title: 'Neues Ticket',
              body: r.subject ?? 'Ticket eingegangen',
              kind: 'info',
              module: 'Tickets',
              href: `/tickets/${r.id}`,
            });
          });
        })());
      }

      await Promise.allSettled(tasks);
      saveSeen(seen);
    };

    // initial run + interval
    const initialDelay = location.pathname.startsWith('/auftraege') ? 5000 : 0;
    const initialTimer = window.setTimeout(tick, initialDelay);
    timer.current = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [user, roles, location.pathname]);
}
