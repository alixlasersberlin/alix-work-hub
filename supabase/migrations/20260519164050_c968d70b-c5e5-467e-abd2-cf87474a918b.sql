
-- 1) Existing 'customer_shipping_notice' template wird zur Teillieferungs-Mail umgewidmet (nur manuell)
UPDATE public.email_templates
SET 
  display_name = 'Kunde – Teillieferung (manuell)',
  subject = 'Ihre Bestellung {{orderNumber}} – Teilanlieferung in unserem Lager',
  body = 'Sehr geehrte/r {{customerName}},

vielen Dank für Ihre Bestellung {{orderNumber}}.

Wir möchten Sie informieren, dass ein Teil Ihrer Bestellung in unserem Lager eingetroffen ist. Da Ihre Bestellung aus mehreren Geräten besteht, warten wir noch auf die Zulieferung der weiteren Geräte.

Sobald die vollständige Lieferung bei uns eingetroffen ist, kontaktieren wir Sie schnellstmöglich zur Vereinbarung eines Liefertermins.

Mit freundlichen Grüßen
Ihr Alix-Lasers Team',
  placeholders = ARRAY['customerName','orderNumber']::text[],
  updated_at = now()
WHERE template_key = 'customer_shipping_notice';

-- 2) Neue automatische Mail bei Zubuchung eines Lagergeräts
INSERT INTO public.email_templates (template_key, display_name, subject, body, placeholders)
VALUES (
  'customer_warehouse_received',
  'Kunde – Lagereingang (automatisch bei Zubuchung)',
  'Ihre Bestellung {{orderNumber}} – Lagereingang erfolgt',
  'Sehr geehrte/r {{customerName}},

vielen Dank für Ihre Bestellung {{orderNumber}}.

Wir freuen uns, Ihnen mitteilen zu können, dass ein Lagereingang erfolgt ist. Wir werden Sie innerhalb der nächsten 2–3 Tage bezüglich eines Liefertermins kontaktieren.

Bitte beachten Sie: Sollte Ihre Bestellung aus mehreren Geräten bestehen, kann es vorkommen, dass zunächst nur eine Teilanlieferung an unser Lager erfolgt ist. In diesem Fall warten wir auf die Zulieferung des weiteren Gerätes und melden uns schnellstmöglich bei Ihnen.

Wir werden Sie schnellstmöglich kontaktieren.

Mit freundlichen Grüßen
Ihr Alix-Lasers Team',
  ARRAY['customerName','orderNumber']::text[]
)
ON CONFLICT DO NOTHING;
