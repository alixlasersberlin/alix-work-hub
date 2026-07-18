CREATE OR REPLACE VIEW public.v_alixsmart_customer_status AS
SELECT c.id AS customer_id,
    COALESCE(
      NULLIF(c.raw_data->>'contact_number', ''),
      NULLIF(c.raw_data->>'customer_number', ''),
      c.external_customer_id
    ) AS customer_number,
    c.company_name,
    c.contact_name,
    c.email,
    c.phone,
    c.billing_address,
    c.shipping_address,
    c.source_system,
    count(DISTINCT d.serial_number) AS device_count,
    array_agg(DISTINCT d.serial_number) AS serial_numbers,
    cl.id AS link_id,
    COALESCE(cl.match_status, 'unregistered'::text) AS match_status,
    cl.match_score,
    cl.alixsmart_user_id,
    cl.last_checked_at,
    cl.last_reminder_at,
    cl.registered_at
FROM public.customers c
JOIN public.v_alixsmart_customer_devices d ON d.customer_id = c.id
LEFT JOIN public.alixsmart_customer_links cl ON cl.alixwork_customer_id = c.id
GROUP BY c.id, cl.id;