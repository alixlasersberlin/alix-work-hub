
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  label text NOT NULL,
  body text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_templates read for authenticated"
  ON public.sms_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sms_templates manage admin"
  ON public.sms_templates FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_sms_templates_updated
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sms_templates (template_key, label, body, sort_order) VALUES
  ('angebot', 'Angebot', 'Hallo {{kunde}}, vielen Dank für Ihr Interesse an Alix Lasers. Ihr persönliches Angebot steht hier für Sie bereit: {{link}} Ihr Alix Lasers Team', 10),
  ('auftragsbestaetigung', 'Auftragsbestätigung', 'Hallo {{kunde}}, Ihre Auftragsbestätigung von Alix Lasers ist verfügbar: {{link}} Bei Fragen sind wir gerne für Sie da.', 20),
  ('anzahlungsrechnung', 'Anzahlungsrechnung', 'Hallo {{kunde}}, Ihre Anzahlungsrechnung zu Ihrem Auftrag ist jetzt verfügbar: {{link}} Vielen Dank, Ihr Alix Lasers Team.', 30),
  ('rechnung', 'Rechnung', 'Hallo {{kunde}}, Ihre Rechnung von Alix Lasers steht hier für Sie bereit: {{link}} Vielen Dank für die Zusammenarbeit.', 40),
  ('lieferschein', 'Lieferschein', 'Hallo {{kunde}}, Ihr Lieferschein wurde erstellt und ist hier abrufbar: {{link}} Ihr Alix Lasers Team.', 50),
  ('reparaturbericht', 'Reparaturbericht', 'Hallo {{kunde}}, der Reparaturbericht zu Ihrem Gerät ist verfügbar: {{link}} Ihr Alix Lasers Service-Team.', 60),
  ('kostenvoranschlag', 'Kostenvoranschlag', 'Hallo {{kunde}}, Ihr Kostenvoranschlag steht zur Prüfung bereit: {{link}} Ihr Alix Lasers Service-Team.', 70),
  ('garantie', 'Garantie / Kulanz', 'Hallo {{kunde}}, Ihre Garantieunterlagen sind hier abrufbar: {{link}} Ihr Alix Lasers Team.', 80),
  ('auftrag', 'Auftrag (allgemein)', 'Hallo {{kunde}}, Ihr Auftrag bei Alix Lasers wurde erstellt. Die Unterlagen finden Sie hier: {{link}} Vielen Dank für Ihr Vertrauen.', 90),
  ('default', 'Standard', 'Hallo {{kunde}}, ein Dokument von Alix Lasers steht hier für Sie bereit: {{link}} Ihr Alix Lasers Team.', 999);
