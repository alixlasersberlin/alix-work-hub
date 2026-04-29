-- Backfill: append -1, -2, ... to existing production_orders that share the same order_number
WITH base AS (
  SELECT
    id,
    regexp_replace(order_number, '-\d+$', '') AS base_number,
    created_at
  FROM public.production_orders
),
grouped AS (
  SELECT
    base_number,
    COUNT(*) AS cnt
  FROM base
  GROUP BY base_number
  HAVING COUNT(*) > 1
),
numbered AS (
  SELECT
    b.id,
    b.base_number,
    ROW_NUMBER() OVER (PARTITION BY b.base_number ORDER BY b.created_at, b.id) AS idx
  FROM base b
  JOIN grouped g ON g.base_number = b.base_number
)
UPDATE public.production_orders po
SET order_number = n.base_number || '-' || n.idx
FROM numbered n
WHERE po.id = n.id
  AND po.order_number IS DISTINCT FROM (n.base_number || '-' || n.idx);