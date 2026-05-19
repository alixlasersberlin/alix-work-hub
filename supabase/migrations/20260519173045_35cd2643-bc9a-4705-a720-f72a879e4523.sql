INSERT INTO public.email_templates (template_key, display_name, subject, body, placeholders)
VALUES (
  'customer_in_production',
  'Kunde – Produktion',
  'Ihre Bestellung {{orderNumber}} befindet sich in Produktion',
  E'Sehr geehrte/r {{customerName}},\n\nvielen Dank für Ihre Bestellung {{orderNumber}}.\n\nIhre Bestellung befindet sich aktuell in Produktion.\n\nFolgendes Gerät wird für Sie produziert:\n{{deviceInfo}}\n\nWir werden Sie über den Fortschritt der Produktion auf dem Laufenden halten. Bitte vereinbaren Sie noch keine Kundentermine, da es zu Verschiebungen während des Versandes kommen kann.\n\nWir werden Sie schnellstmöglich kontaktieren.\n\nMit freundlichen Grüßen\nIhr Alix-Lasers Team',
  ARRAY['customerName','orderNumber','deviceInfo']
)
ON CONFLICT (template_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      placeholders = EXCLUDED.placeholders;