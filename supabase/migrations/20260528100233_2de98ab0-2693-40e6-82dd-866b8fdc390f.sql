INSERT INTO public.email_templates (template_key, display_name, subject, body, placeholders)
VALUES (
  'customer_delivered',
  'Kunde – Geliefert (automatisch bei Statuswechsel)',
  'Ihre Bestellung {{orderNumber}} wurde ausgeliefert',
  E'Sehr geehrte/r {{customerName}},\n\nIhre Bestellung {{orderNumber}} wurde erfolgreich an Sie ausgeliefert.\n\nGelieferte Geräte:\n{{deviceInfo}}\n\nWir wünschen Ihnen viel Erfolg mit Ihren neuen Geräten. Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIhr Alix-Lasers Team',
  ARRAY['customerName','orderNumber','deviceInfo']
)
ON CONFLICT (template_key) DO NOTHING;