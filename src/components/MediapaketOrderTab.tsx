import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Copy, ExternalLink, RefreshCw, Package as PackageIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import MediapaketReviewPanel from './MediapaketReviewPanel';

interface Props {
  orderId: string;
  customerId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Nicht begonnen',
  in_progress: 'In Bearbeitung',
  question_required: 'Rückfrage nötig',
  customer_correction: 'Korrektur beim Kunden',
  submitted: 'Eingereicht',
  in_review: 'In Prüfung',
  approval_pending: 'Freigabe ausstehend',
  in_production: 'In Produktion',
  completed: 'Abgeschlossen',
};

export default function MediapaketOrderTab({ orderId, customerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [mp, setMp] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('media_packages')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    setMp(data);
    if (data?.id) {
      const { data: prog } = await supabase.rpc('calc_media_package_progress', { _mp_id: data.id });
      setProgress(Number(prog) || 0);
      const [services, studio, devices, prices, contact, hours, treatments, team, branding, files, consents] = await Promise.all([
        supabase.from('media_package_services').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_studio_data').select('*').eq('media_package_id', data.id).maybeSingle(),
        supabase.from('media_package_devices').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_prices').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_contact_data').select('*').eq('media_package_id', data.id).maybeSingle(),
        supabase.from('media_package_opening_hours').select('*').eq('media_package_id', data.id).order('weekday'),
        supabase.from('media_package_treatments').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_team_members').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_branding').select('*').eq('media_package_id', data.id).maybeSingle(),
        supabase.from('media_package_files').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_consents').select('*').eq('media_package_id', data.id),
      ]);
      setSections({
        services: services.data || [], studio: studio.data, devices: devices.data || [],
        prices: prices.data || [], contact: contact.data, hours: hours.data || [],
        treatments: treatments.data || [], team: team.data || [], branding: branding.data,
        files: files.data || [], consents: consents.data || [],
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  const createPackage = async () => {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('media_packages').insert({
      order_id: orderId,
      customer_id: customerId,
      status: 'not_started',
      created_by: userData.user?.id,
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mediapaket erstellt');
    setMp(data);
    load();
  };

  const copyCustomerLink = async () => {
    if (!mp?.id) return;
    setIssuing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mediapaket-portal', {
        body: { action: 'issue_token', mp_id: mp.id },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Fehler');
      const fullUrl = `${window.location.origin}${data.url}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Kundenlink kopiert', { description: fullUrl });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Mediapaket...</div>;
  }

  if (!mp) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
        <PackageIcon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Kein Mediapaket vorhanden</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Erstelle ein neues Mediapaket für diesen Auftrag und teile den Kundenlink zur Datenerfassung.
        </p>
        <Button onClick={createPackage} disabled={creating} className="gold-gradient text-primary-foreground">
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Mediapaket erstellen
        </Button>
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[mp.status] ?? mp.status;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PackageIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Mediapaket</h3>
              <Badge variant="outline">{statusLabel}</Badge>
              {mp.submitted_at && <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Eingereicht</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">ID: {mp.id}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Aktualisieren</Button>
            <Button size="sm" onClick={copyCustomerLink} disabled={issuing} className="gold-gradient text-primary-foreground">
              {issuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
              Kundenlink kopieren
            </Button>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Fortschritt</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full gold-gradient transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Review-Panel: Status, Kommentare, Rückfragen, Verlauf */}
      <MediapaketReviewPanel mpId={mp.id} currentStatus={mp.status} onChanged={load} />

      {/* Sections */}
      <SectionCard title="Leistungsauswahl" empty={!sections.services?.length}>
        {sections.services?.map((s: any) => (
          <div key={s.id} className="flex justify-between text-sm">
            <span>{s.service_type}</span>
            <span className="text-muted-foreground">{s.selected ? '✓' : '—'}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Studio-Daten" empty={!sections.studio}>
        {sections.studio && <KV data={sections.studio} skip={['id','media_package_id','created_at','updated_at']} />}
      </SectionCard>

      <SectionCard title="Geräte" empty={!sections.devices?.length}>
        {sections.devices?.map((d: any) => (
          <div key={d.id} className="text-sm">
            <span className="font-medium">{d.entered_model_name || '—'}</span>
            {d.serial_number && <span className="text-muted-foreground"> · SN: {d.serial_number}</span>}
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Preisliste" empty={!sections.prices?.length}>
        {sections.prices?.map((p: any) => (
          <div key={p.id} className="flex justify-between text-sm">
            <span>{p.description || p.category}</span>
            <span className="text-muted-foreground">{p.price != null ? `${p.price} €` : '—'}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Kontaktdaten" empty={!sections.contact}>
        {sections.contact && <KV data={sections.contact} skip={['id','media_package_id','created_at','updated_at']} />}
      </SectionCard>

      <SectionCard title="Öffnungszeiten" empty={!sections.hours?.length}>
        {sections.hours?.map((h: any) => (
          <div key={h.id} className="flex justify-between text-sm">
            <span>Tag {h.weekday}</span>
            <span className="text-muted-foreground">
              {h.closed ? 'Geschlossen' : `${h.first_start ?? ''}–${h.first_end ?? ''}${h.second_start ? ` / ${h.second_start}–${h.second_end ?? ''}` : ''}`}
            </span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Fremdbehandlungen" empty={!sections.treatments?.length}>
        {sections.treatments?.map((t: any) => (
          <div key={t.id} className="text-sm">{t.description || t.category}</div>
        ))}
      </SectionCard>

      <SectionCard title="Team / Über mich" empty={!sections.team?.length && !sections.branding?.about_me}>
        {sections.branding?.about_me && <p className="text-sm whitespace-pre-wrap">{sections.branding.about_me}</p>}
        {sections.team?.map((m: any) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</span>
            {m.role && <span className="text-muted-foreground"> · {m.role}</span>}
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Branding / Anmerkungen" empty={!sections.branding}>
        {sections.branding && <KV data={sections.branding} skip={['id','media_package_id','created_at','updated_at']} />}
      </SectionCard>

      <SectionCard title="Dateien" empty={!sections.files?.length}>
        {sections.files?.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between text-sm">
            <span>{f.original_filename} <span className="text-muted-foreground">({f.category})</span></span>
            <span className="text-muted-foreground text-xs">{f.file_size ? `${Math.round(f.file_size / 1024)} KB` : ''}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Einwilligungen" empty={!sections.consents?.length}>
        {sections.consents?.map((c: any) => (
          <div key={c.id} className="flex justify-between text-sm">
            <span>{c.consent_type}</span>
            <span className="text-muted-foreground">{c.accepted ? '✓ erteilt' : '—'}</span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
      {empty ? <p className="text-xs text-muted-foreground">— Noch keine Angaben —</p> : <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function KV({ data, skip = [] }: { data: Record<string, any>; skip?: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      {Object.entries(data).filter(([k, v]) => !skip.includes(k) && v !== null && v !== '' && v !== false).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-border/40 py-1">
          <span className="text-muted-foreground text-xs">{k}</span>
          <span className="text-right truncate max-w-[60%]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </div>
      ))}
    </div>
  );
}
