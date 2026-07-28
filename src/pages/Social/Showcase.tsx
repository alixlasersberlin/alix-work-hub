// Public Showcase page for Social-Media Kunden (1:1 zu MediapaketShowcase)
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Send, Check, Globe, Instagram } from 'lucide-react';
import { toast } from 'sonner';

type Post = { id: string; title: string | null; content: string; platform: string; media_urls: string[]; published_at: string | null };
type Highlight = { label: string; value: string };
type ShowcaseData = {
  client: { company_name: string; industry: string | null; website: string | null; logo_url: string | null };
  accounts: { platform: string; username: string | null }[];
  posts: Post[];
  highlights: Highlight[];
};

export default function SocialShowcase() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setError('Kein Token'); setLoading(false); return; }
      const { data: r, error: err } = await supabase.functions.invoke('social-showcase-public', {
        body: { action: 'get_showcase', token },
      });
      if (err || (r as any)?.error) { setError((r as any)?.error || err?.message || 'Fehler'); setLoading(false); return; }
      setData(r as ShowcaseData);
      setLoading(false);
    })();
  }, [token]);

  const submitLead = async () => {
    if (!leadForm.name.trim() || !leadForm.email.trim()) { toast.error('Name & E-Mail erforderlich'); return; }
    setSubmitting(true);
    const { data: r, error: err } = await supabase.functions.invoke('social-showcase-public', {
      body: { action: 'create_lead', token, lead: leadForm },
    });
    setSubmitting(false);
    if (err || (r as any)?.error) { toast.error((r as any)?.error || 'Fehler'); return; }
    setLeadSubmitted(true);
    toast.success('Danke! Wir melden uns bei Ihnen.');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center bg-background text-center p-6"><div><h1 className="text-2xl font-semibold mb-2">Nicht verfügbar</h1><p className="text-muted-foreground">{error}</p></div></div>;

  const c = data.client;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border py-10 px-6 text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary mb-3">
          <Sparkles className="w-3 h-3" /> Social-Media Referenz
        </div>
        {c.logo_url && (
          <img src={c.logo_url} alt={c.company_name} className="mx-auto mb-4 h-16 w-16 rounded-full object-cover border border-border" />
        )}
        <h1 className="text-4xl font-semibold">{c.company_name}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          {c.industry && <span>{c.industry}</span>}
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Globe className="w-3 h-3" />{c.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-10 px-6 space-y-8">
        {data.accounts.length > 0 && (
          <Section title="Plattformen">
            <div className="flex flex-wrap gap-2">
              {data.accounts.map((a, i) => (
                <span key={i} className="px-3 py-1 rounded-full border border-primary/30 text-sm inline-flex items-center gap-2">
                  <Instagram className="w-3 h-3" />
                  {a.platform}{a.username ? ` · ${a.username}` : ''}
                </span>
              ))}
            </div>
          </Section>
        )}

        {data.posts.length > 0 && (
          <Section title="Ausgewählte Beiträge">
            <div className="grid gap-4 md:grid-cols-2">
              {data.posts.map((p) => (
                <article key={p.id} className="border border-border rounded-xl overflow-hidden bg-background/40">
                  {p.media_urls[0] && (
                    <img src={p.media_urls[0]} alt={p.title ?? p.platform} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="uppercase tracking-wider">{p.platform}</span>
                      {p.published_at && <span>{new Date(p.published_at).toLocaleDateString('de-DE')}</span>}
                    </div>
                    {p.title && <div className="font-medium">{p.title}</div>}
                    {p.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{p.content}</p>}
                  </div>
                </article>
              ))}
            </div>
          </Section>
        )}

        {data.highlights.length > 0 && (
          <Section title="Marketing-Highlights">
            <dl className="grid gap-3 md:grid-cols-2">
              {data.highlights.map((h, i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <dt className="text-xs uppercase tracking-wider text-primary">{h.label}</dt>
                  <dd className="text-sm mt-1 whitespace-pre-wrap">{h.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {/* CTA — Lead form */}
        <div className="rounded-2xl border border-primary/40 bg-card p-6 card-glow">
          <h2 className="text-xl font-semibold mb-1">Das möchte ich auch</h2>
          <p className="text-sm text-muted-foreground mb-4">Lassen Sie uns über Ihre Social-Media-Strategie sprechen — kostenfreie Erstberatung.</p>
          {leadSubmitted ? (
            <div className="flex items-center gap-2 text-emerald-400"><Check className="w-5 h-5" /> Danke! Wir melden uns in Kürze.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Ihr Name*" value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} />
              <Input type="email" placeholder="E-Mail*" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} />
              <Input placeholder="Telefon (optional)" value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} />
              <div className="md:col-span-2">
                <Textarea rows={3} placeholder="Ihre Nachricht (optional)" value={leadForm.message} onChange={e => setLeadForm({ ...leadForm, message: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={submitLead} disabled={submitting} className="gold-gradient text-primary-foreground">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Anfrage senden
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Präsentiert von Alix Lasers — <a href="https://alixwork.de" className="text-primary hover:underline">alixwork.de</a>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 card-glow">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
