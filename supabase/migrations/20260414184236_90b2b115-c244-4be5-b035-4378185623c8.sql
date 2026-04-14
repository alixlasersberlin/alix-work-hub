-- Fill expected_shipment_date from raw_data where available
UPDATE public.orders
SET expected_shipment_date = (raw_data->>'shipment_date')::timestamp with time zone
WHERE expected_shipment_date IS NULL
  AND raw_data->>'shipment_date' IS NOT NULL
  AND raw_data->>'shipment_date' != '';

-- Fill remaining with today + 56 days
UPDATE public.orders
SET expected_shipment_date = now() + interval '56 days'
WHERE expected_shipment_date IS NULL;