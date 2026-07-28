// Social Media Fragenkatalog – analog zum Mediapaket-Tab.
// Aus einem Auftrag heraus: Social-Client anlegen/verknüpfen, Kunden-Link
// versenden/kopieren, Fortschritt & Antworten anzeigen.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, Copy, RefreshCw, Mail, CheckCircle2, Share2, ExternalLink,
  MessageSquare, ListChecks, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Props {
  orderId: string;
  customerId: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook_page: 'Facebook',
  x_profile: 'X (Twitter)',
  linkedin_personal: 'LinkedIn (Profil)',
  linkedin_company: 'LinkedIn (Unternehmen)',
  instagram: 'Instagram',
  google_business: 'Google Unternehmen',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  mastodon: 'Mastodon',
  threads: 'Threads',
  bluesky: 'Bluesky',
};

const QUESTION_LABEL: Record<string, string> = {
  q1_ads: 'Aktuelle Werbemaßnahmen',
  q2_presence: 'Aktuelle Online-Präsenz',
  q3_goals: 'Ziele im Social Media',
  q4_audience: 'Zielgruppe',
  q5_focus_products: 'Fokus-Produkte / Leistungen',
  q6_promotions: 'Aktionen & Angebote',
  q7_ci_guidelines: 'Corporate Design',
  q8_content_types: 'Inhalte',
  q9_frequency: 'Frequenz',
  q10_competitors: 'Mitbewerber',
  q11_hashtags: 'Hashtags / Suchbegriffe',
  q12_regions: 'Regionen / Länder',
  q13_avoid: 'Zu vermeidende Themen',
  q14_contact: 'Ansprechpartner',
  q15_extra_access: 'Weitere Zugänge',
};

export default function SocialOnboardingOrderTab({ orderId, customerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let cust: any = null;
      if (customerId) {
        const { data } = await supabase
          .from('customers')
          .select('id, company_name, contact_name, email, phone')
          .eq('id', customerId)
          .maybeSingle();
        cust = data;
        setCustomer(data);
      }

      // Client über customer_id verknüpft finden (bevorzugt), sonst nach E-Mail
      let cl: any = null;
      if (customerId) {
        const { data } = await supabase
          .from('social_clients')
          .select('*')
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .maybeSingle();
        cl = data;
      }
      if (!cl && cust?.email) {
        const { data } = await supabase
          .from('social_clients')
          .select('*')
          .eq('email', cust.email)
          .is('deleted_at', null)
          .maybeSingle();
        cl = data;
      }
      setClient(cl);
      setRecipientEmail(cl?.email || cust?.email || '');

      if (cl?.id) {
        const { data: q } = await supabase
          .from('social_questionnaire')
          .select('*')
          .eq('client_id', cl.id)
          .is('deleted_at', null)
          .maybeSingle();
        setQuestionnaire(q);
      } else {
        setQuestionnaire(null);
      }
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const createClient = async () => {
    if (!customer) { toast.error('Kein Kunde am Auftrag verknüpft'); return; }
    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('social_clients').insert({
        company_name: customer.company_name || customer.contact_name || 'Kunde',
        contact_person: customer.contact_name || null,
        email: customer.email || null,
        phone: customer.phone || null,
        customer_id: customer.id,
        created_by: userData.user?.id ?? null,
        onboarding_status: 'invited',
        onboarding_step: 0,
      } as any).select().single();
      if (error) throw error;
      toast.success('Social-Kunde angelegt');
      setClient(data);
      setRecipientEmail(data.email || '');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const invite = async (mode: 'copy' | 'email') => {
    if (!client?.id) return;
    const to = (recipientEmail || '').trim();
    if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error('Bitte gültige E-Mail-Adresse eintragen');
      return;
    }
    if (mode === 'email' && !confirm(`Fragenkatalog per E-Mail an ${to} versenden?`)) return;

    if (mode === 'email') setSending(true); else setCopying(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-onboarding-invite', {
        body: {
          client_id: client.id,
          recipient_email: mode === 'email' ? to : undefined,
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      const link: string | undefined = (data as any)?.link;
      if (!link) throw new Error('Kein Link erhalten');

      if (mode === 'copy') {
        await navigator.clipboard.writeText(link);
        toast.success('Kundenlink kopiert', { description: link });
      } else {
        toast.success('E-Mail gesendet an ' + (data as any)?.sent_to);
      }
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
      setCopying(false);
    }
  };

  const answers = (questionnaire?.answers ?? {}) as any;
  const platformCount = useMemo(() => {
    const p = (answers?.platforms || {}) as Record<string, any>;
    return Object.values(p).filter((v: any) =>
      v && (v.username || v.password || v.admin_invited)
    ).length;
  }, [answers]);
  const answeredCount = useMemo(() => {
    const q = (answers?.questions || {}) as Record<string, string>;
    return Object.values(q).filter((v) => (v || '').trim().length > 0).length;
  }, [answers]);
  const totalQuestions = 15;
  const progress = questionnaire?.submitted_at
    ? 100
    : Math.round((answeredCount / totalQuestions) * 100);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Lade Social-Media-Fragenkatalog…
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
        <Lock className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Kein Kunde verknüpft</h3>
        <p className="text-sm text-muted-foreground">
          Verknüpfe zuerst einen Kunden mit diesem Auftrag, um den Social-Media-Fragenkatalog zu versenden.
        </p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
        <Share2 className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Social-Media Fragenkatalog</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Für <span className="font-medium text-foreground">{customer?.company_name || customer?.contact_name}</span> ist noch
          kein Social-Kunde angelegt. Lege ihn jetzt an und versende den Fragenkatalog wie beim Mediapaket.
        </p>
        <Button onClick={createClient} disabled={creating} className="gold-gradient text-primary-foreground">
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Social-Kunde anlegen & Fragenkatalog vorbereiten
        </Button>
      </div>
    );
  }

  const statusLabel = questionnaire?.submitted_at
    ? 'Eingereicht'
    : answeredCount > 0
    ? 'In Bearbeitung'
    : 'Wartet auf Kunden';
  const statusColor = questionnaire?.submitted_at
    ? 'bg-green-500/20 text-green-500 border-green-500/40'
    : answeredCount > 0
    ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Share2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Social-Media Fragenkatalog</h3>
              <Badge variant="outline" className={statusColor}>{statusLabel}</Badge>
              {questionnaire?.submitted_at && (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {new Date(questionnaire.submitted_at).toLocaleDateString('de-DE')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {client.company_name}
              {client.contact_person ? ` · ${client.contact_person}` : ''} · Social-Client-ID: {client.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-2" />Aktualisieren
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/social/fragebogen?client=${client.id}`}>
                <ExternalLink className="w-4 h-4 mr-2" />Intern anzeigen
              </Link>
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => invite('email')} disabled={sending}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Per E-Mail senden
            </Button>
            <Button
              size="sm"
              onClick={() => invite('copy')} disabled={copying}
              className="gold-gradient text-primary-foreground"
            >
              {copying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
              Kundenlink kopieren
            </Button>
          </div>
        </div>

        {/* Recipient email + progress */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Empfänger-E-Mail</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="kunde@beispiel.de"
              className="h-9 text-sm mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Wird für den Versand des Fragenkatalog-Links verwendet.
            </p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fortschritt</Label>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full gold-gradient transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{answeredCount} / {totalQuestions} Fragen · {platformCount} Plattform-Zugänge</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vorschau der Antworten */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">Kundenantworten</h4>
        </div>

        {!questionnaire && (
          <p className="text-sm text-muted-foreground">
            Der Kunde hat den Fragenkatalog noch nicht geöffnet. Nach Versand erscheinen die Antworten hier automatisch.
          </p>
        )}

        {questionnaire && (
          <div className="space-y-4">
            {/* Plattformen */}
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Plattform-Zugänge ({platformCount})
              </h5>
              {platformCount === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Zugänge übermittelt.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries((answers.platforms || {}) as Record<string, any>)
                    .filter(([_, v]) => v && (v.username || v.password || v.admin_invited))
                    .map(([k, v]: [string, any]) => (
                      <div key={k} className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
                        <div className="font-medium text-foreground">{PLATFORM_LABEL[k] ?? k}</div>
                        <div className="text-muted-foreground truncate">
                          {v.admin_invited ? 'Admin-Zugriff eingeladen' : v.username || '—'}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Fragen */}
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Fragen ({answeredCount} / {totalQuestions})
              </h5>
              <div className="space-y-2">
                {Object.entries(QUESTION_LABEL).map(([k, label]) => {
                  const val = ((answers.questions || {}) as Record<string, string>)[k] || '';
                  return (
                    <div key={k} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
                      <div className="text-sm text-foreground whitespace-pre-wrap mt-0.5">
                        {val ? val : <span className="text-muted-foreground italic">— noch offen —</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {answers.materials_note && (
              <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Anmerkung zu Unterlagen
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{answers.materials_note}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
