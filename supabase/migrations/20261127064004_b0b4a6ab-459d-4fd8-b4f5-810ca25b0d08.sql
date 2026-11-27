CREATE OR REPLACE FUNCTION public.ph_shadow_signal_enqueue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; secret text;
BEGIN
  pid := CASE WHEN TG_TABLE_NAME = 'ph_products' THEN NEW.id ELSE NEW.product_id END;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET';
  IF secret IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ph-signal-shadow',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secret),
    body := jsonb_build_object('product_id', pid, 'source', TG_TABLE_NAME));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- shadow mode must never block product edits
END $$;
REVOKE ALL ON FUNCTION public.ph_shadow_signal_enqueue() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ph_products_shadow_signal ON public.ph_products;
CREATE TRIGGER ph_products_shadow_signal
AFTER UPDATE OF active_de, active_com, active_dubai, status, name, slug, hero_image_url ON public.ph_products
FOR EACH ROW WHEN (
  OLD.active_de IS DISTINCT FROM NEW.active_de OR OLD.active_com IS DISTINCT FROM NEW.active_com
  OR OLD.active_dubai IS DISTINCT FROM NEW.active_dubai OR OLD.status IS DISTINCT FROM NEW.status
  OR OLD.name IS DISTINCT FROM NEW.name OR OLD.slug IS DISTINCT FROM NEW.slug
  OR OLD.hero_image_url IS DISTINCT FROM NEW.hero_image_url)
EXECUTE FUNCTION public.ph_shadow_signal_enqueue();

DROP TRIGGER IF EXISTS ph_product_channels_shadow_signal ON public.ph_product_channels;
CREATE TRIGGER ph_product_channels_shadow_signal
AFTER UPDATE OF hold, status ON public.ph_product_channels
FOR EACH ROW WHEN ((OLD.hold IS DISTINCT FROM NEW.hold OR OLD.status IS DISTINCT FROM NEW.status)
  AND NEW.channel_code IN ('de','com','dubai'))
EXECUTE FUNCTION public.ph_shadow_signal_enqueue();