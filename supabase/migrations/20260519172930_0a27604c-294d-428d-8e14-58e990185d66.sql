INSERT INTO public.email_templates (template_key, display_name, subject, body, placeholders)
VALUES (
  'customer_in_transit',
  'Kunde – Unterwegs',
  'Ihre Bestellung {{orderNumber}} ist unterwegs in unser Lager',
  E'Sehr geehrte/r {{customerName}},\n\nvielen Dank für Ihre Bestellung {{orderNumber}}.\n\nIhre Bestellung ist aktuell unterwegs in unser Lager. Nach aktueller Lage rechnen wir mit einer Anlieferung in 2-3 Wochen spätestens.\n\nFolgendes Gerät ist für Sie unterwegs:\n{{deviceInfo}}\n\nSobald die Ware bei uns eingetroffen ist, werden wir Sie schnellstmöglich kontaktieren, um einen genauen Liefertermin zu vereinbaren.\n\nMit freundlichen Grüßen\nIhr Alix-Lasers Team',
  ARRAY['customerName','orderNumber','deviceInfo']
)
ON CONFLICT (template_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      placeholders = EXCLUDED.placeholders;