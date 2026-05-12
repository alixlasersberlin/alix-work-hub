import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DrivingResult {
  duration_text: string;
  duration_seconds: number;
  distance_text: string;
}

type DrivingTimeMap = Record<string, DrivingResult | null>;

interface CacheEntry {
  addressKey: string;
  result: DrivingResult | null;
  timestamp: number;
}

const CACHE_PREFIX = 'dt_v1_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 Woche

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

function addressKey(address: string | null): string {
  return (address ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function readCache(orderId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + orderId);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(orderId: string, entry: CacheEntry) {
  try {
    localStorage.setItem(CACHE_PREFIX + orderId, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

function clearCache(orderId: string) {
  try { localStorage.removeItem(CACHE_PREFIX + orderId); } catch { /* noop */ }
}

export function useDrivingTimes() {
  const [drivingTimes, setDrivingTimes] = useState<DrivingTimeMap>({});
  const [loading, setLoading] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const fetchDrivingTimes = useCallback(async (orders: any[]) => {
    const now = Date.now();
    const cachedHits: DrivingTimeMap = {};
    const toFetch: { id: string; address: string }[] = [];
    const attemptedIds = new Set<string>();

    for (const o of orders) {
      attemptedIds.add(o.id);
      const address = resolveAddress(o);
      if (!address) continue;

      const key = addressKey(address);
      const cached = readCache(o.id);

      // Cache gilt nur wenn Adresse unverändert UND nicht älter als 1 Woche
      if (cached && cached.addressKey === key && now - cached.timestamp < CACHE_TTL_MS) {
        cachedHits[o.id] = cached.result;
      } else {
        // Adresse hat sich geändert oder Cache veraltet → neu abrufen
        toFetch.push({ id: o.id, address });
      }
    }

    setRequestedIds(prev => {
      const next = new Set(prev);
      attemptedIds.forEach(id => next.add(id));
      return next;
    });

    if (Object.keys(cachedHits).length > 0) {
      setDrivingTimes(prev => ({ ...prev, ...cachedHits }));
    }

    if (toFetch.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-driving-time', {
        body: { destinations: toFetch },
      });

      if (!error && data?.results) {
        const results = data.results as DrivingTimeMap;
        // Cache schreiben (mit jeweiliger aktueller Adresse als Key)
        for (const item of toFetch) {
          const result = results[item.id] ?? null;
          writeCache(item.id, {
            addressKey: addressKey(item.address),
            result,
            timestamp: Date.now(),
          });
        }
        setDrivingTimes(prev => ({ ...prev, ...results }));
      }
    } catch (e) {
      console.error('Driving time fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const retryFailed = useCallback(async (orders: any[]) => {
    const failed = orders.filter(o => drivingTimes[o.id] === null);
    if (failed.length === 0) return;
    // Cache fehlgeschlagener Einträge verwerfen, damit sofort neu geholt wird
    failed.forEach(o => clearCache(o.id));
    setDrivingTimes(prev => {
      const next = { ...prev };
      failed.forEach(o => { delete next[o.id]; });
      return next;
    });
    setRequestedIds(prev => {
      const next = new Set(prev);
      failed.forEach(o => next.delete(o.id));
      return next;
    });
    await fetchDrivingTimes(failed);
  }, [drivingTimes, fetchDrivingTimes]);

  return { drivingTimes, loading, requestedIds, fetchDrivingTimes, retryFailed };
}
