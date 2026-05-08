import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DrivingResult {
  duration_text: string;
  duration_seconds: number;
  distance_text: string;
}

type DrivingTimeMap = Record<string, DrivingResult | null>;

function resolveAddress(order: any): string | null {
  const hasAddr = (a: any) => a && (a.city || a.address || a.street || a.zip || a.postal_code);
  const addr =
    (hasAddr(order.customers?.shipping_address) ? order.customers?.shipping_address : null) ||
    (hasAddr(order.customers?.billing_address) ? order.customers?.billing_address : null) ||
    (hasAddr(order.shipping_address) ? order.shipping_address : null) ||
    (hasAddr(order.billing_address) ? order.billing_address : null);

  if (!addr) return null;
  if (typeof addr === 'string') return addr;

  const parts = [
    addr.address || addr.street || '',
    addr.zip || addr.postal_code || '',
    addr.city || '',
    addr.country || '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

export function useDrivingTimes() {
  const [drivingTimes, setDrivingTimes] = useState<DrivingTimeMap>({});
  const [loading, setLoading] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const fetchDrivingTimes = useCallback(async (orders: any[]) => {
    const destinations = orders
      .map(o => {
        const address = resolveAddress(o);
        return address ? { id: o.id, address } : null;
      })
      .filter(Boolean) as { id: string; address: string }[];

    // Track which order IDs were attempted (incl. those with no address)
    const attemptedIds = new Set(orders.map(o => o.id));
    setRequestedIds(prev => {
      const next = new Set(prev);
      attemptedIds.forEach(id => next.add(id));
      return next;
    });

    if (destinations.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-driving-time', {
        body: { destinations },
      });

      if (!error && data?.results) {
        setDrivingTimes(prev => ({ ...prev, ...data.results }));
      }
    } catch (e) {
      console.error('Driving time fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { drivingTimes, loading, requestedIds, fetchDrivingTimes };
}

