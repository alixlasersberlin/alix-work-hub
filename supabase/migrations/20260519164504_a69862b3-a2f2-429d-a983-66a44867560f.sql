UPDATE email_templates
SET body = 'Sehr geehrte/r {{customerName}},

vielen Dank für Ihre Bestellung {{orderNumber}}.

Wir möchten Sie informieren, dass ein Teil Ihrer Bestellung in unserem Lager eingetroffen ist. Da Ihre Bestellung aus mehreren Geräten besteht, warten wir noch auf die Zulieferung der weiteren Geräte.

Bereits eingetroffene/reservierte Geräte:
{{deviceInfo}}

Sobald die vollständige Lieferung bei uns eingetroffen ist, kontaktieren wir Sie schnellstmöglich zur Vereinbarung eines Liefertermins.

Mit freundlichen Grüßen
Ihr Alix-Lasers Team',
    placeholders = ARRAY['customerName','orderNumber','deviceInfo'],
    updated_at = now()
WHERE template_key = 'customer_shipping_notice';

UPDATE email_templates
SET body = 'Sehr geehrte/r {{customerName}},

vielen Dank für Ihre Bestellung {{orderNumber}}.

Wir freuen uns, Ihnen mitteilen zu können, dass folgendes Gerät an unserem Lager eingegangen ist:
{{deviceInfo}}

Wir werden Sie innerhalb der nächsten 2–3 Tage bezüglich eines Liefertermins kontaktieren.

Bitte beachten Sie: Sollte Ihre Bestellung aus mehreren Geräten bestehen, kann es vorkommen, dass zunächst nur eine Teilanlieferung an unser Lager erfolgt ist. In diesem Fall warten wir auf die Zulieferung des weiteren Gerätes und melden uns schnellstmöglich bei Ihnen.

Wir werden Sie schnellstmöglich kontaktieren.

Mit freundlichen Grüßen
Ihr Alix-Lasers Team',
    placeholders = ARRAY['customerName','orderNumber','deviceInfo'],
    updated_at = now()
WHERE template_key = 'customer_warehouse_received';