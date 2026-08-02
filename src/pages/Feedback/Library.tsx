// Vorlagen-Bibliothek: fertige Umfragen mit einem Klick anlegen.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FeedbackHeader } from './_shared';
import { toast } from 'sonner';
import { Library, Plus, Clock } from 'lucide-react';

type TplQuestion = {
  qtype: string;
  label: string;
  help_text?: string;
  required?: boolean;
  options?: string[];
};

type Tpl = {
  key: string;
  name: string;
  public_title: string;
  intro_text: string;
  outro_text: string;
  est_minutes: number;
  tags: string[];
  questions: TplQuestion[];
};

const TEMPLATES: Tpl[] = [
  {
    key: 'nps',
    name: 'NPS – Weiterempfehlung',
    public_title: 'Wie zufrieden sind Sie mit uns?',
    intro_text: 'Guten Tag {{name}}, Ihre Meinung hilft uns, besser zu werden. Die Umfrage dauert nur eine Minute.',
    outro_text: 'Vielen Dank für Ihre Rückmeldung!',
    est_minutes: 1,
    tags: ['Kurz', 'NPS', 'Klassiker'],
    questions: [
      { qtype: 'nps', label: 'Wie wahrscheinlich ist es, dass Sie uns weiterempfehlen?', required: true },
      { qtype: 'textarea', label: 'Was ist der Hauptgrund für Ihre Bewertung?' },
      { qtype: 'testimonial_ok', label: 'Dürfen wir Ihre Rückmeldung als Referenz veröffentlichen?' },
    ],
  },
  {
    key: 'csat',
    name: 'Zufriedenheit nach Auftrag',
    public_title: 'Ihr Feedback zu unserem Auftrag',
    intro_text: 'Hallo {{name}}, Ihr Auftrag ist abgeschlossen – wie zufrieden waren Sie mit uns?',
    outro_text: 'Danke! Wir melden uns bei Rückfragen.',
    est_minutes: 2,
    tags: ['Auftrag', 'Service'],
    questions: [
      { qtype: 'stars', label: 'Wie zufrieden sind Sie insgesamt?', required: true },
      { qtype: 'stars', label: 'Wie bewerten Sie die Beratung?' },
      { qtype: 'stars', label: 'Wie bewerten Sie die Lieferung / Installation?' },
      { qtype: 'single', label: 'Wurde der Termin eingehalten?', options: ['Ja, pünktlich', 'Leicht verspätet', 'Deutlich verspätet'] },
      { qtype: 'textarea', label: 'Was können wir verbessern?' },
      { qtype: 'contact_ok', label: 'Dürfen wir Sie zu Ihrer Rückmeldung kontaktieren?' },
    ],
  },
  {
    key: 'device',
    name: 'Produkt- & Gerätefeedback',
    public_title: 'Wie läuft Ihr Gerät?',
    intro_text: 'Hallo {{name}}, wir möchten wissen, wie zufrieden Sie mit Ihrem Gerät sind.',
    outro_text: 'Vielen Dank – Ihre Angaben fließen direkt in unsere Produktentwicklung ein.',
    est_minutes: 3,
    tags: ['Produkt', 'Technik'],
    questions: [
      { qtype: 'stars', label: 'Wie zufrieden sind Sie mit dem Gerät?', required: true },
      { qtype: 'single', label: 'Wie oft nutzen Sie das Gerät?', options: ['Täglich', 'Mehrmals pro Woche', 'Wöchentlich', 'Seltener'] },
      { qtype: 'multi', label: 'Welche Funktionen nutzen Sie am häufigsten?', options: ['Standardbehandlung', 'Spezialprogramme', 'Dokumentation', 'Wartungsassistent'] },
      { qtype: 'yesno', label: 'Gab es technische Probleme?' },
      { qtype: 'textarea', label: 'Welche Funktion wünschen Sie sich zusätzlich?' },
      { qtype: 'upload', label: 'Optional: Foto oder Dokument hochladen' },
    ],
  },
  {
    key: 'training',
    name: 'Schulung & Einweisung',
    public_title: 'Feedback zur Schulung',
    intro_text: 'Hallo {{name}}, bitte bewerten Sie Ihre Schulung bei {{firma}}.',
    outro_text: 'Danke für Ihre Bewertung der Schulung!',
    est_minutes: 2,
    tags: ['Academy', 'Schulung'],
    questions: [
      { qtype: 'stars', label: 'Wie bewerten Sie die Schulung insgesamt?', required: true },
      { qtype: 'scale10', label: 'Wie verständlich waren die Inhalte?' },
      { qtype: 'yesno', label: 'Fühlen Sie sich sicher im Umgang mit dem Gerät?' },
      { qtype: 'multi', label: 'Welche Themen wünschen Sie sich vertieft?', options: ['Anwendung', 'Sicherheit', 'Marketing', 'Abrechnung', 'Wartung'] },
      { qtype: 'textarea', label: 'Anmerkungen zur Schulung' },
    ],
  },
  {
    key: 'onboarding',
    name: 'Onboarding neuer Kunden',
    public_title: 'Ihr Start bei uns',
    intro_text: 'Willkommen {{name}}! Ein paar kurze Fragen zu Ihrem Start.',
    outro_text: 'Danke – wir begleiten Sie weiter.',
    est_minutes: 2,
    tags: ['Neukunde', 'Onboarding'],
    questions: [
      { qtype: 'stars', label: 'Wie bewerten Sie den Start mit uns?', required: true },
      { qtype: 'single', label: 'Wie gut fühlten Sie sich informiert?', options: ['Sehr gut', 'Gut', 'Ausreichend', 'Unzureichend'] },
      { qtype: 'yesno', label: 'Sind alle Zugänge und Unterlagen bei Ihnen angekommen?' },
      { qtype: 'textarea', label: 'Was hat Ihnen beim Start gefehlt?' },
    ],
  },
  {
    key: 'support',
    name: 'Support & Ticketabschluss',
    public_title: 'War unser Support hilfreich?',
    intro_text: 'Hallo {{name}}, Ihr Anliegen wurde bearbeitet. Wie zufrieden waren Sie?',
    outro_text: 'Danke für Ihr Feedback zum Support!',
    est_minutes: 1,
    tags: ['Support', 'Tickets', 'Kurz'],
    questions: [
      { qtype: 'stars', label: 'Wie zufrieden waren Sie mit der Bearbeitung?', required: true },
      { qtype: 'single', label: 'Wurde Ihr Anliegen gelöst?', options: ['Vollständig gelöst', 'Teilweise gelöst', 'Nicht gelöst'] },
      { qtype: 'scale10', label: 'Wie bewerten Sie die Reaktionszeit?' },
      { qtype: 'textarea', label: 'Ihre Anmerkungen' },
    ],
  },
];

export default function FeedbackLibrary() {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  async function createFrom(tpl: Tpl) {
    setBusy(tpl.key);
    const sb = supabase as any;
    const { data: survey, error } = await sb.from('surveys').insert({
      name: tpl.name,
      public_title: tpl.public_title,
      intro_text: tpl.intro_text,
      outro_text: tpl.outro_text,
      est_minutes: tpl.est_minutes,
      status: 'entwurf',
      language: 'de',
    }).select().single();
    if (error || !survey) { setBusy(null); toast.error(error?.message ?? 'Fehler beim Anlegen'); return; }

    let pos = 1;
    for (const q of tpl.questions) {
      const { data: nq, error: qe } = await sb.from('survey_questions').insert({
        survey_id: survey.id,
        qtype: q.qtype,
        label: q.label,
        help_text: q.help_text ?? null,
        required: q.required ?? false,
        position: pos++,
      }).select().single();
      if (qe) { toast.error(qe.message); break; }
      if (q.options?.length && nq) {
        await sb.from('survey_question_options').insert(
          q.options.map((o, i) => ({ question_id: nq.id, label: o, value: o, position: i + 1 })),
        );
      }
    }
    setBusy(null);
    toast.success('Umfrage aus Vorlage erstellt');
    nav(`/umfragen/${survey.id}`);
  }

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Vorlagen-Bibliothek"
        subtitle="Fertige Umfragen mit einem Klick anlegen und anschließend anpassen"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map(tpl => (
          <Card key={tpl.key} className="border-border/60 bg-card/50 backdrop-blur flex flex-col">
            <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Library className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{tpl.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{tpl.public_title}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {tpl.tags.map(t => <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>)}
              </div>

              <ul className="text-sm text-muted-foreground space-y-1 flex-1">
                {tpl.questions.slice(0, 4).map((q, i) => (
                  <li key={i} className="truncate">• {q.label}</li>
                ))}
                {tpl.questions.length > 4 && (
                  <li className="text-xs">+ {tpl.questions.length - 4} weitere Fragen</li>
                )}
              </ul>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />{tpl.est_minutes} Min · {tpl.questions.length} Fragen
                </span>
                <Button size="sm" disabled={busy !== null} onClick={() => createFrom(tpl)}>
                  <Plus className="h-4 w-4 mr-1" />{busy === tpl.key ? 'Erstelle …' : 'Verwenden'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
