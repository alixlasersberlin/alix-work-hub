import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';

// Druckbare Zusammenfassung eines Mediapakets — Route: /mediapaket/print/:mpId
// Nutzt window.print() für PDF-Erzeugung via Browser (Speichern als PDF).

export default function MediapaketPrint() {
  const { mpId } = useParams();
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    if (!mpId) return;
    (async () => {
      const [mp, services, studio, devices, prices, contact, hours, treatments, team, branding, files, consents, customer] = await Promise.all([
        supabase.from('media_packages').select('*').eq('id', mpId).maybeSingle(),
        supabase.from('media_package_services').select('*').eq('media_package_id', mpId),
        supabase.from('media_package_studio_data').select('*').eq('media_package_id', mpId).maybeSingle(),
        supabase.from('media_package_devices').select('*').eq('media_package_id', mpId),
        supabase.from('media_package_prices').select('*').eq('media_package_id', mpId).order('sort_order'),
        supabase.from('media_package_contact_data').select('*').eq('media_package_id', mpId).maybeSingle(),
        supabase.from('media_package_opening_hours').select('*').eq('media_package_id', mpId).order('weekday'),
        supabase.from('media_package_treatments').select('*').eq('media_package_id', mpId),
        supabase.from('media_package_team_members').select('*').eq('media_package_id', mpId),
        supabase.from('media_package_branding').select('*').eq('media_package_id', mpId).maybeSingle(),
        supabase.from('media_package_files').select('*').eq('media_package_id', mpId),
        supabase.from('media_package_consents').select('*').eq('media_package_id', mpId),
        (async () => {
          const { data: root } = await supabase.from('media_packages').select('customer_id').eq('id', mpId).maybeSingle();
          if (!root?.customer_id) return { data: null };
          return supabase.from('customers').select('name, email, phone').eq('id', root.customer_id).maybeSingle();
        })(),
      ]);
      setD({
        mp: mp.data, services: services.data || [], studio: studio.data, devices: devices.data || [],
        prices: prices.data || [], contact: contact.data, hours: hours.data || [], treatments: treatments.data || [],
        team: team.data || [], branding: branding.data, files: files.data || [], consents: consents.data || [],
        customer: customer.data,
      });
      setLoading(false);
    })();
  }, [mpId]);

  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;
  if (!d?.mp) return <div className="p-8">Mediapaket nicht gefunden.</div>;

  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const serviceLabels: Record<string, string> = { website: 'Webseite', flyer: 'Flyer', social_media: 'Social Media' };

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page-break { page-break-before: always; }
        }
        .mp-section { break-inside: avoid; }
      `}</style>

      <div className="no-print sticky top-0 z-50 border-b bg-white p-3 flex justify-end gap-2">
        <Button onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" /> Drucken / Als PDF speichern</Button>
      </div>

      <div className="max-w-3xl mx-auto p-8 print:p-4 space-y-6 text-sm">
        <header className="border-b-2 border-black pb-4">
          <div className="text-xs uppercase tracking-widest text-neutral-500">Alix Lasers · Media Paket</div>
          <h1 className="text-2xl font-bold mt-1">{d.mp.studio_name || d.customer?.name || 'Mediapaket'}</h1>
          <div className="text-xs text-neutral-600 mt-1">
            ID: {d.mp.id} · Status: {d.mp.status} · Fortschritt: {d.mp.progress_percent ?? 0}%
            {d.mp.submitted_at && ` · Eingereicht: ${new Date(d.mp.submitted_at).toLocaleDateString('de-DE')}`}
          </div>
        </header>

        <Section title="Kunde">
          <KV label="Name" value={d.customer?.name} />
          <KV label="E-Mail" value={d.customer?.email} />
          <KV label="Telefon" value={d.customer?.phone} />
        </Section>

        <Section title="Gewünschte Leistungen">
          {d.services.filter((s: any) => s.selected).length === 0 && <p className="text-neutral-500">Keine ausgewählt</p>}
          <ul className="list-disc pl-5">
            {d.services.filter((s: any) => s.selected).map((s: any) => (
              <li key={s.id}>{serviceLabels[s.service_type] || s.service_type}</li>
            ))}
          </ul>
        </Section>

        {d.studio && (
          <Section title="Studio & Domain">
            <KV label="Studioname" value={d.studio.studio_name} />
            <KV label="Ansprechpartner" value={d.studio.contact_name} />
            <KV label="Wunschdomain" value={d.studio.desired_domain} />
            <KV label="Alt. Domain" value={d.studio.alternative_domain} />
            <KV label="Bestehende Domain" value={d.studio.existing_domain} />
            <KV label="Firmenname Web" value={d.studio.company_name_website} />
            <KV label="Firmenname Print" value={d.studio.company_name_print} />
          </Section>
        )}

        {d.devices.length > 0 && (
          <Section title={`Geräte (${d.devices.length})`}>
            <ul className="list-disc pl-5">
              {d.devices.map((v: any) => <li key={v.id}>{v.model_name}{v.serial_number ? ` · SN: ${v.serial_number}` : ''}</li>)}
            </ul>
          </Section>
        )}

        {d.prices.length > 0 && (
          <Section title={`Preisliste (${d.prices.length})`}>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b"><th className="text-left py-1">Behandlung</th><th className="text-left py-1">Bereich</th><th className="text-right py-1">Preis</th></tr></thead>
              <tbody>
                {d.prices.map((p: any) => (
                  <tr key={p.id} className="border-b border-neutral-200">
                    <td className="py-1">{p.treatment_name}</td>
                    <td className="py-1">{p.area || '—'}</td>
                    <td className="py-1 text-right">{p.price != null ? `${Number(p.price).toFixed(2)} ${p.currency || 'EUR'}` : '—'}</td>
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
            <KV label="Straße" value={d.contact.street} />
            <KV label="PLZ / Ort" value={[d.contact.zip, d.contact.city].filter(Boolean).join(' ')} />
            <KV label="Instagram" value={d.contact.instagram} />
            <KV label="TikTok" value={d.contact.tiktok} />
            <KV label="Facebook" value={d.contact.facebook} />
          </Section>
        )}

        {d.hours.length > 0 && (
          <Section title="Öffnungszeiten">
            <table className="text-xs">
              <tbody>
                {d.hours.map((h: any) => (
                  <tr key={h.id}>
                    <td className="pr-4 font-medium">{WD[h.weekday] || h.weekday}</td>
                    <td>{h.closed ? 'Geschlossen' : `${h.open_time || '—'} – ${h.close_time || '—'}${h.notes ? ` (${h.notes})` : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {d.treatments.length > 0 && (
          <Section title={`Fremdbehandlungen (${d.treatments.length})`}>
            <ul className="list-disc pl-5">
              {d.treatments.map((t: any) => <li key={t.id}>{t.name}{t.price != null ? ` — ${t.price} ${t.currency || 'EUR'}` : ''}{t.description ? ` · ${t.description}` : ''}</li>)}
            </ul>
          </Section>
        )}

        {d.branding && (
          <Section title="Über mich / Design">
            <KV label="Über mich" value={d.branding.about_me} multiline />
            <KV label="Team-Beschreibung" value={d.branding.team_description} multiline />
            <KV label="Design-Stil" value={d.branding.design_style} />
            <KV label="Farbwünsche" value={d.branding.color_preferences} />
            <KV label="Bemerkungen" value={d.branding.notes} multiline />
          </Section>
        )}

        {d.team.length > 0 && (
          <Section title={`Team (${d.team.length})`}>
            <ul className="list-disc pl-5">
              {d.team.map((t: any) => <li key={t.id}>{t.name}{t.role ? ` — ${t.role}` : ''}</li>)}
            </ul>
          </Section>
        )}

        {d.files.length > 0 && (
          <Section title={`Dateien (${d.files.length})`}>
            <ul className="text-xs space-y-1">
              {d.files.map((f: any) => (
                <li key={f.id} className="border-b border-neutral-200 py-1">
                  <span className="font-medium">[{f.category}]</span> {f.original_filename}
                  {f.file_size && ` · ${Math.round(f.file_size / 1024)} KB`}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {d.consents.length > 0 && (
          <Section title="Einwilligungen">
            <ul className="text-xs">
              {d.consents.map((c: any) => (
                <li key={c.id}>
                  {c.accepted ? '✓' : '✗'} <span className="font-medium">{c.consent_type}</span>
                  {c.accepted_at && ` · ${new Date(c.accepted_at).toLocaleDateString('de-DE')}`}
                </li>
              ))}
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
    <section className="mp-section">
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
