INSERT INTO public.email_templates (template_key, display_name, subject, body, placeholders)
VALUES (
  'customer_warehouse_prepared',
  'Kunde – Warehouse',
  'Ihre Bestellung {{orderNumber}} wird für die Produktion vorbereitet',
  E'Sehr geehrte/r {{customerName}},\n\nvielen Dank für Ihre Bestellung {{orderNumber}}.\n\nIhre Bestellung wird nun für die Produktion vorbereitet und alle Teile sind entsprechend vorhanden. Da unsere Modelle zu 100% handgemacht sind, leiten wir die Montage des Gerätes in den nächsten Tagen ein.\n\nFolgendes Gerät wird für Sie vorbereitet:\n{{deviceInfo}}\n\nWir halten Sie über den Fortschritt auf dem Laufenden und freuen uns, Sie bald beliefern zu können.\n\nWir werden Sie schnellstmöglich kontaktieren.\n\nMit freundlichen Grüßen\nIhr Alix-Lasers Team',
  ARRAY['customerName','orderNumber','deviceInfo']
)
ON CONFLICT (template_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      placeholders = EXCLUDED.placeholders;