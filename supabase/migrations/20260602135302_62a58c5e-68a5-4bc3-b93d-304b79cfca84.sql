WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY reserved_order_id, model_name
           ORDER BY updated_at DESC, created_at DESC, id
         ) AS rn
  FROM public.lager_devices
  WHERE reserved_order_id IS NOT NULL
)
UPDATE public.lager_devices d
   SET reserved_order_id = NULL,
       reservation_week = NULL,
       updated_at = now()
  FROM ranked
 WHERE d.id = ranked.id
   AND ranked.rn > 1;