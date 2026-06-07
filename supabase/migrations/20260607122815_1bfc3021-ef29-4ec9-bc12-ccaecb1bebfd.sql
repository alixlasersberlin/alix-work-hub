
-- Phase 10: Ersatzteilmanagement & Lagerautomation (additive)

-- 1. Extend zoho_items with spare-part stock-control fields
ALTER TABLE public.zoho_items
  ADD COLUMN IF NOT EXISTS min_stock numeric,
  ADD COLUMN IF NOT EXISTS reorder_level numeric,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS serial_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_supplier_name text,
  ADD COLUMN IF NOT EXISTS lead_time_days integer,
  ADD COLUMN IF NOT EXISTS is_spare_part boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_reserved numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_on_order numeric DEFAULT 0;

-- 2. Purchase orders to suppliers
CREATE TABLE IF NOT EXISTS public.spare_part_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  status text NOT NULL DEFAULT 'Entwurf',
  ordered_at timestamptz,
  expected_at date,
  total_amount numeric,
  currency text DEFAULT 'EUR',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.spare_part_orders TO authenticated;
GRANT ALL ON public.spare_part_orders TO service_role;
ALTER TABLE public.spare_part_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_orders_read ON public.spare_part_orders FOR SELECT TO authenticated USING (public.can_access_repair() OR public.has_role('Bestellwesen') OR public.has_role('Finance'));
CREATE POLICY sp_orders_mod ON public.spare_part_orders FOR ALL TO authenticated USING (public.is_admin() OR public.has_role('Bestellwesen') OR public.has_role('Technik') OR public.has_role('Reparaturannahme')) WITH CHECK (public.is_admin() OR public.has_role('Bestellwesen') OR public.has_role('Technik') OR public.has_role('Reparaturannahme'));

CREATE TABLE IF NOT EXISTS public.spare_part_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.spare_part_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.zoho_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  sku text,
  quantity numeric NOT NULL DEFAULT 1,
  received_quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spare_part_order_items TO authenticated;
GRANT ALL ON public.spare_part_order_items TO service_role;
ALTER TABLE public.spare_part_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_order_items_read ON public.spare_part_order_items FOR SELECT TO authenticated USING (public.can_access_repair() OR public.has_role('Bestellwesen') OR public.has_role('Finance'));
CREATE POLICY sp_order_items_mod ON public.spare_part_order_items FOR ALL TO authenticated USING (public.is_admin() OR public.has_role('Bestellwesen') OR public.has_role('Technik') OR public.has_role('Reparaturannahme')) WITH CHECK (public.is_admin() OR public.has_role('Bestellwesen') OR public.has_role('Technik') OR public.has_role('Reparaturannahme'));

-- 3. Goods receipts (Wareneingang persistent)
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text,
  order_id uuid REFERENCES public.spare_part_orders(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.zoho_items(id) ON DELETE SET NULL,
  item_name text,
  sku text,
  quantity numeric NOT NULL,
  supplier text,
  delivery_note text,
  serial_numbers text[],
  notes text,
  received_by uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.goods_receipts TO authenticated;
GRANT ALL ON public.goods_receipts TO service_role;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY gr_read ON public.goods_receipts FOR SELECT TO authenticated USING (public.can_access_repair() OR public.has_role('Bestellwesen') OR public.has_role('Finance'));
CREATE POLICY gr_mod ON public.goods_receipts FOR ALL TO authenticated USING (public.is_admin() OR public.has_role('Bestellwesen') OR public.has_role('Technik') OR public.has_role('Reparaturannahme')) WITH CHECK (public.is_admin() OR public.has_role('Bestellwesen') OR public.has_role('Technik') OR public.has_role('Reparaturannahme'));

-- 4. Consumption log (unifies parts used across repair/maintenance/dispatch/warranty)
CREATE TABLE IF NOT EXISTS public.spare_part_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.zoho_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  sku text,
  quantity numeric NOT NULL DEFAULT 1,
  source_type text NOT NULL,
  source_id uuid,
  device_serial text,
  customer_id uuid,
  customer_name text,
  technician_id uuid,
  warranty_case boolean DEFAULT false,
  notes text,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.spare_part_consumption TO authenticated;
GRANT ALL ON public.spare_part_consumption TO service_role;
ALTER TABLE public.spare_part_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY spc_read ON public.spare_part_consumption FOR SELECT TO authenticated USING (public.can_access_repair() OR public.has_role('Bestellwesen') OR public.has_role('Finance') OR public.has_role('Tourenplanung'));
CREATE POLICY spc_mod ON public.spare_part_consumption FOR ALL TO authenticated USING (public.is_admin() OR public.has_role('Technik') OR public.has_role('Reparaturannahme') OR public.has_role('Bestellwesen')) WITH CHECK (public.is_admin() OR public.has_role('Technik') OR public.has_role('Reparaturannahme') OR public.has_role('Bestellwesen'));

CREATE INDEX IF NOT EXISTS idx_spc_serial ON public.spare_part_consumption(device_serial);
CREATE INDEX IF NOT EXISTS idx_spc_source ON public.spare_part_consumption(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_spc_item ON public.spare_part_consumption(item_id);

-- 5. Technician van stock
CREATE TABLE IF NOT EXISTS public.technician_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  item_id uuid REFERENCES public.zoho_items(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  sku text,
  quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric,
  vehicle_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technician_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_stock TO authenticated;
GRANT ALL ON public.technician_stock TO service_role;
ALTER TABLE public.technician_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY tst_read ON public.technician_stock FOR SELECT TO authenticated USING (public.is_admin() OR public.has_role('Technik') OR public.has_role('Serviceleitung') OR public.has_role('Reparaturannahme') OR public.has_role('Bestellwesen') OR technician_id = auth.uid());
CREATE POLICY tst_mod ON public.technician_stock FOR ALL TO authenticated USING (public.is_admin() OR public.has_role('Serviceleitung') OR public.has_role('Bestellwesen') OR technician_id = auth.uid()) WITH CHECK (public.is_admin() OR public.has_role('Serviceleitung') OR public.has_role('Bestellwesen') OR technician_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.technician_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  item_id uuid REFERENCES public.zoho_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  sku text,
  quantity numeric NOT NULL,
  movement_type text NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.technician_stock_movements TO authenticated;
GRANT ALL ON public.technician_stock_movements TO service_role;
ALTER TABLE public.technician_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tsm_read ON public.technician_stock_movements FOR SELECT TO authenticated USING (public.is_admin() OR public.has_role('Technik') OR public.has_role('Serviceleitung') OR public.has_role('Bestellwesen') OR technician_id = auth.uid());
CREATE POLICY tsm_ins ON public.technician_stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role('Serviceleitung') OR public.has_role('Bestellwesen') OR technician_id = auth.uid());

-- 6. Sequence + trigger for spare_part_orders numbering
CREATE SEQUENCE IF NOT EXISTS public.spare_part_order_seq;
CREATE OR REPLACE FUNCTION public.assign_spare_part_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.order_number IS NULL OR length(trim(NEW.order_number)) = 0 THEN
    NEW.order_number := 'EB-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.spare_part_order_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_assign_spo_number ON public.spare_part_orders;
CREATE TRIGGER trg_assign_spo_number BEFORE INSERT ON public.spare_part_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_spare_part_order_number();

DROP TRIGGER IF EXISTS trg_spo_updated ON public.spare_part_orders;
CREATE TRIGGER trg_spo_updated BEFORE UPDATE ON public.spare_part_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tst_updated ON public.technician_stock;
CREATE TRIGGER trg_tst_updated BEFORE UPDATE ON public.technician_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Goods receipt trigger: bump stock_on_hand of linked item
CREATE OR REPLACE FUNCTION public.apply_goods_receipt_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.item_id IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
    UPDATE public.zoho_items
       SET stock_on_hand = COALESCE(stock_on_hand,0) + NEW.quantity,
           stock_on_order = GREATEST(COALESCE(stock_on_order,0) - NEW.quantity, 0),
           updated_at = now()
     WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gr_apply_stock ON public.goods_receipts;
CREATE TRIGGER trg_gr_apply_stock AFTER INSERT ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.apply_goods_receipt_stock();

-- 8. Consumption trigger: decrement stock + push device_lifecycle "Ersatzteil"
CREATE OR REPLACE FUNCTION public.apply_consumption_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.item_id IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
    UPDATE public.zoho_items
       SET stock_on_hand = GREATEST(COALESCE(stock_on_hand,0) - NEW.quantity, 0),
           updated_at = now()
     WHERE id = NEW.item_id;
  END IF;
  IF NEW.device_serial IS NOT NULL THEN
    PERFORM public.dl_upsert(
      NEW.device_serial, NULL, NEW.customer_id, NEW.customer_name,
      'Ersatzteil', NEW.consumed_at, 'spare_part_consumption', NEW.id::text,
      COALESCE(NEW.item_name,'Ersatzteil') || ' x' || COALESCE(NEW.quantity,1),
      jsonb_build_object('source_type', NEW.source_type, 'source_id', NEW.source_id, 'warranty_case', NEW.warranty_case)
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_spc_apply_stock ON public.spare_part_consumption;
CREATE TRIGGER trg_spc_apply_stock AFTER INSERT ON public.spare_part_consumption
  FOR EACH ROW EXECUTE FUNCTION public.apply_consumption_stock();

-- 9. Helper view: spare-part stock overview
CREATE OR REPLACE VIEW public.spare_part_stock_overview AS
SELECT
  i.id,
  i.name,
  i.sku,
  i.category_name,
  i.manufacturer,
  i.brand,
  i.storage_location,
  i.purchase_rate AS ek,
  i.rate AS vk,
  COALESCE(i.stock_on_hand,0) AS stock_on_hand,
  COALESCE(i.stock_reserved,0) AS stock_reserved,
  GREATEST(COALESCE(i.stock_on_hand,0) - COALESCE(i.stock_reserved,0), 0) AS stock_available,
  COALESCE(i.stock_on_order,0) AS stock_on_order,
  i.min_stock,
  i.reorder_level,
  i.primary_supplier_id,
  i.primary_supplier_name,
  i.lead_time_days,
  i.serial_required,
  i.is_spare_part,
  CASE
    WHEN i.min_stock IS NOT NULL AND COALESCE(i.stock_on_hand,0) <= i.min_stock THEN 'kritisch'
    WHEN i.reorder_level IS NOT NULL AND COALESCE(i.stock_on_hand,0) <= i.reorder_level THEN 'meldebestand'
    ELSE 'ok'
  END AS stock_status
FROM public.zoho_items i;
GRANT SELECT ON public.spare_part_stock_overview TO authenticated;
