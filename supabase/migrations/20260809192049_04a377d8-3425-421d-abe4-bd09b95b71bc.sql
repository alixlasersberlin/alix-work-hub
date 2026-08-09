UPDATE public.tenants
SET legal_name = 'Alix Lasers ® Austria',
    address_line1 = 'Grillweg 7',
    address_line2 = 'Top 1.2',
    postal_code = '8053',
    city = 'Graz',
    country_name = 'Österreich',
    country = COALESCE(country, 'AT'),
    vat_id = 'ATU81780805',
    bank_details = 'Bankinstitut: Raiffeisen Bank Graz-Straßgang' || chr(10) ||
                   'IBAN: AT45 3843 9000 0087 3737' || chr(10) ||
                   'Empfänger: Alix Lasers GmbH',
    updated_at = now()
WHERE code = 'AT';