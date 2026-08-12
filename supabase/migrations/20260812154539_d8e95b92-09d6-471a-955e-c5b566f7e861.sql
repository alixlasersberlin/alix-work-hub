UPDATE public.zoho_invoices i
SET billing_address = jsonb_build_object('attention','Friseur & Beauty by Nuri Tikic','address','Bismarckstrasse 59','zip','10627','city','Berlin','country','Deutschland'),
    city = 'Berlin',
    updated_at = now()
WHERE i.invoice_number = 'RE-REP-2026081101';