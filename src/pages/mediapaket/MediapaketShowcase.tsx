// Phase 45 — Public Showcase Page for Mediapakete
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Send, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function MediapaketShowcase() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setError('Kein Token'); setLoading(false); return; }
      const { data: r, error: err } = await supabase.functions.invoke('mediapaket-public', {
        body: { action: 'get_showcase', token },
      });
      if (err || (r as any)?.error) { setError((r as any)?.error || err?.message || 'Fehler'); setLoading(false); return; }
      setData(r);
      setLoading(false);
    })();
  }, [token]);

  const submitLead = async () => {
    if (!leadForm.name.trim() || !leadForm.email.trim()) { toast.error('Name & E-Mail erforderlich'); return; }
    setSubmitting(true);
    const { data: r, error: err } = await supabase.functions.invoke('mediapaket-public', {
      body: { action: 'create_lead', token, lead: leadForm },
    });
    setSubmitting(false);
    if (err || (r as any)?.error) { toast.error((r as any)?.error || 'Fehler'); return; }
    setLeadSubmitted(true);
    toast.success('Danke! Wir melden uns bei Ihnen.');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-center p-6"><div><h1 className="text-2xl font-semibold mb-2">Nicht verfügbar</h1><p className="text-muted-foreground">{error}</p></div></div>;

  const mp = data.package || {};
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border py-8 px-6 text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary mb-2">
          <Sparkles className="w-3 h-3" /> Referenzprojekt
        </div>
        <h1 className="text-4xl font-semibold">{mp.studio_name || 'Mediapaket-Showcase'}</h1>
        {mp.tagline && <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{mp.tagline}</p>}
      </header>

      <main className="max-w-4xl mx-auto py-10 px-6 space-y-8">
        {mp.services?.length > 0 && (
          <Section title="Leistungen">
            <div className="flex flex-wrap gap-2">
              {mp.services.map((s: string, i: number) => <span key={i} className="px-3 py-1 rounded-full border border-primary/30 text-sm">{s}</span>)}
            </div>
          </Section>
        )}
        {mp.treatments?.length > 0 && (
          <Section title="Behandlungen">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {mp.treatments.map((t: string, i: number) => <div key={i} className="border border-border rounded-lg p-3 text-sm">{t}</div>)}
            </div>
          </Section>
        )}
        {mp.team?.length > 0 && (
          <Section title="Team">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {mp.team.map((m: any, i: number) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted mb-2" />
                  <div className="text-sm font-medium">{m.name}</div>
                  {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}
        {mp.brand_story && (
          <Section title="Über das Studio">
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{mp.brand_story}</p>
          </Section>
        )}

        {/* CTA — Lead form */}
        <div className="rounded-2xl border border-primary/40 bg-card p-6 card-glow">
          <h2 className="text-xl font-semibold mb-1">Das möchte ich auch</h2>
          <p className="text-sm text-muted-foreground mb-4">Lassen Sie uns über Ihr Mediapaket sprechen — kostenfreie Erstberatung.</p>
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
