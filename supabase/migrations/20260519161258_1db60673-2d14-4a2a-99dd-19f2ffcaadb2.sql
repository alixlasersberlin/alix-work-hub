
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  placeholders text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read templates"
ON public.email_templates FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins insert templates"
ON public.email_templates FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins update templates"
ON public.email_templates FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete templates"
ON public.email_templates FOR DELETE
TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_email_templates_updated_by
BEFORE INSERT OR UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

INSERT INTO public.email_templates (template_key, display_name, subject, body, placeholders)
VALUES (
  'customer_shipping_notice',
  'Kunde – Voravisierung Lieferung',
  'Ihre Bestellung {{orderNumber}} – Voravisierung zur Lieferung',
  E'Sehr geehrte/r {{customerName}},\n\nvielen Dank für Ihre Bestellung {{orderNumber}}.\n\nWir freuen uns, Ihnen mitteilen zu können, dass Ihre Bestellung innerhalb der nächsten 2–3 Wochen zur Auslieferung kommt.\n\nDen genauen Liefertermin vereinbaren wir mit Ihnen, nachdem das Gerät bei uns im Lager eingegangen ist.\n\nBei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIhr Alix-Lasers Team',
  ARRAY['customerName','orderNumber']
)
ON CONFLICT (template_key) DO NOTHING;
