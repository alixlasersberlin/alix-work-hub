// Calendar-Sync-Helpers: baut ICS-Download + Deep-Links für Google, Outlook (Web /
// Microsoft 365), Office.com, Yahoo sowie iCal/Apple, Thunderbird, Samsung
// Kalender (alle konsumieren die .ics-Datei) und CalDAV-/HTTP-Subscription.
import type { EscAppointment } from '@/lib/esc/types';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export interface CalendarLinks {
  google: string;
  outlookWeb: string;
  office365: string;
  yahoo: string;
  icsDownload: () => void;
  subscribe: (token: string) => { webcal: string; https: string };
}

export function calendarLinks(a: EscAppointment): CalendarLinks {
  const start = fmt(a.startAt);
  const end = fmt(a.endAt);
  const text = encodeURIComponent(a.title || 'Termin');
  const details = encodeURIComponent(a.description || a.externalNote || '');
  const location = encodeURIComponent(a.location || a.address || '');

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`,
    outlookWeb: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${text}&body=${details}&location=${location}&startdt=${encodeURIComponent(a.startAt)}&enddt=${encodeURIComponent(a.endAt)}`,
    office365: `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${text}&body=${details}&location=${location}&startdt=${encodeURIComponent(a.startAt)}&enddt=${encodeURIComponent(a.endAt)}`,
    yahoo: `https://calendar.yahoo.com/?v=60&title=${text}&st=${start}&et=${end}&desc=${details}&in_loc=${location}`,
    icsDownload: async () => {
      // Prefer server ICS (token-signed) so calendar apps can re-fetch updates.
      try {
        const { data } = await supabase.functions.invoke('esc-token-issue', {
          body: { event_id: a.id, action: 'ics', ttl_hours: 24 * 365 },
        });
        if (data?.token) {
          const url = `${SUPABASE_URL}/functions/v1/esc-ics?token=${encodeURIComponent(data.token)}`;
          window.open(url, '_blank');
          return;
        }
      } catch { /* fall through */ }
      // Fallback: client-side ICS
      const { downloadIcs } = await import('@/lib/esc/ics');
      downloadIcs(a);
    },
    subscribe: (token: string) => {
      const https = `${SUPABASE_URL}/functions/v1/esc-ics?token=${encodeURIComponent(token)}`;
      const webcal = https.replace(/^https?:/, 'webcal:');
      return { webcal, https };
    },
  };
}

/** Issue (or reuse) a personal ICS feed token for the current user. */
export async function issueFeedToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('esc-feed-issue', { body: {} });
  if (error) throw error;
  return data.token as string;
}
