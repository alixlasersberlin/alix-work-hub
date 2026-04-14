-- Add salesperson_name column to orders
ALTER TABLE public.orders ADD COLUMN salesperson_name text;

-- Backfill from raw_data
UPDATE public.orders
SET salesperson_name = raw_data->>'salesperson_name'
WHERE raw_data->>'salesperson_name' IS NOT NULL;