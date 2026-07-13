DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_item_prices;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.catalog_items REPLICA IDENTITY FULL;
ALTER TABLE public.catalog_item_prices REPLICA IDENTITY FULL;