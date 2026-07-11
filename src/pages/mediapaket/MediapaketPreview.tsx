// Public read-only preview of a Mediapaket via token (Phase 30)
// Route: /preview/mediapaket?token=...

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Printer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FN_URL = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/mediapaket-portal`;
const ANON = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function MediapaketPreview() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    if (!token) { setErr('Kein Zugriffs-Token angegeben.'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?action=get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({ token }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Fehler');
        setD(j);
      } catch (e: any) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center gap-2 p-8 bg-white text-black"><Loader2 className="w-4 h-4 animate-spin" /> Lade Vorschau…</div>;
  if (err) return <div className="min-h-screen p-8 bg-white text-black text-destructive">{err}</div>;
  if (!d) return null;

  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const serviceLabels: Record<string, string> = { website: 'Webseite', flyer: 'Flyer', social_media: 'Social Media' };

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print sticky top-0 z-50 border-b bg-white p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm"><Eye className="w-4 h-4" /> Schreibgeschützte Vorschau</div>
        <Button onClick={() => window.print()} size="sm" className="gap-2"><Printer className="w-4 h-4" />Als PDF speichern</Button>
      </div>

      <div className="max-w-3xl mx-auto p-8 print:p-4 space-y-6 text-sm">
        <header className="border-b-2 border-black pb-4">
          <div className="text-xs uppercase tracking-widest text-neutral-500">Alix Lasers · Media Paket · Vorschau</div>
          <h1 className="text-2xl font-bold mt-1">{d.root?.studio_name || 'Mediapaket'}</h1>
          <div className="text-xs text-neutral-600 mt-1">Status: {d.root?.status} · Fortschritt: {d.progress ?? 0}%</div>
        </header>

        <Section title="Gewünschte Leistungen">
          {(d.services || []).filter((s: any) => s.selected).length === 0 && <p className="text-neutral-500">Keine ausgewählt</p>}
          <ul className="list-disc pl-5">
            {(d.services || []).filter((s: any) => s.selected).map((s: any) => (
              <li key={s.id}>{serviceLabels[s.service_type] || s.service_type}</li>
            ))}
          </ul>
        </Section>

        {d.studio && (
          <Section title="Studio">
            <KV label="Studioname" value={d.studio.studio_name} />
            <KV label="Ansprechpartner" value={d.studio.contact_name} />
            <KV label="Wunschdomain" value={d.studio.desired_domain} />
            <KV label="Firmenname Web" value={d.studio.company_name_website} />
            <KV label="Firmenname Print" value={d.studio.company_name_print} />
          </Section>
        )}

        {(d.devices || []).length > 0 && (
          <Section title={`Geräte (${d.devices.length})`}>
            <ul className="list-disc pl-5">
              {d.devices.map((v: any) => <li key={v.id}>{v.entered_model_name || v.model_name}{v.serial_number ? ` · SN: ${v.serial_number}` : ''}</li>)}
            </ul>
          </Section>
        )}

        {(d.prices || []).length > 0 && (
          <Section title={`Preisliste (${d.prices.length})`}>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {d.prices.map((p: any) => (
                  <tr key={p.id} className="border-b border-neutral-200">
                    <td className="py-1">{p.description || p.treatment_name || p.category}</td>
                    <td className="py-1 text-right">{p.price != null ? `${Number(p.price).toFixed(2)} €` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {d.contact && (
          <Section title="Kontakt & Social">
            <KV label="Telefon" value={d.contact.phone} />
            <KV label="E-Mail" value={d.contact.email} />
            <KV label="WhatsApp" value={d.contact.whatsapp} />
            <KV label="Adresse" value={[d.contact.street, d.contact.zip, d.contact.city].filter(Boolean).join(', ')} />
            <KV label="Instagram" value={d.contact.instagram} />
            <KV label="TikTok" value={d.contact.tiktok} />
            <KV label="Facebook" value={d.contact.facebook} />
          </Section>
        )}

        {(d.hours || []).length > 0 && (
          <Section title="Öffnungszeiten">
            <table className="text-xs">
              <tbody>
                {d.hours.map((h: any) => (
                  <tr key={h.id}>
                    <td className="pr-4 font-medium">{WD[h.weekday] || h.weekday}</td>
                    <td>{h.closed ? 'Geschlossen' : `${h.first_start || h.open_time || '—'}–${h.first_end || h.close_time || '—'}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {(d.treatments || []).length > 0 && (
          <Section title={`Fremdbehandlungen (${d.treatments.length})`}>
            <ul className="list-disc pl-5">
              {d.treatments.map((t: any) => <li key={t.id}>{t.name}{t.price != null ? ` — ${t.price} €` : ''}</li>)}
            </ul>
          </Section>
        )}

        {d.branding && (
          <Section title="Über mich / Design">
            <KV label="Über mich" value={d.branding.about_me} multiline />
            <KV label="Design-Stil" value={d.branding.design_style} />
            <KV label="Farbwünsche" value={d.branding.color_preferences} />
          </Section>
        )}

        {(d.files || []).length > 0 && (
          <Section title={`Dateien (${d.files.length})`}>
            <ul className="text-xs">
              {d.files.map((f: any) => <li key={f.id}>[{f.category}] {f.original_filename}</li>)}
            </ul>
          </Section>
        )}

        <footer className="pt-8 mt-8 border-t text-[10px] text-neutral-500">
          Erstellt am {new Date().toLocaleString('de-DE')} · Alix Lasers · Vertraulich
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold border-b border-neutral-300 pb-1 mb-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function KV({ label, value, multiline }: { label: string; value?: any; multiline?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className={multiline ? '' : 'flex gap-2'}>
      <span className="text-neutral-500 min-w-[140px]">{label}:</span>
      <span className={multiline ? 'block whitespace-pre-wrap' : ''}>{String(value)}</span>
    </div>
  );
}
