-- Categories table
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized roles can read product categories"
ON public.product_categories FOR SELECT TO authenticated
USING (can_access_orders() OR can_access_finance());

CREATE POLICY "managers can insert product categories"
ON public.product_categories FOR INSERT TO authenticated
WITH CHECK (can_manage_orders());

CREATE POLICY "managers can update product categories"
ON public.product_categories FOR UPDATE TO authenticated
USING (can_manage_orders())
WITH CHECK (can_manage_orders());

CREATE POLICY "admins can delete product categories"
ON public.product_categories FOR DELETE TO authenticated
USING (is_admin());

CREATE TRIGGER trg_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_product_categories_updated_by
BEFORE UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

-- Assignment table (many-to-many)
CREATE TABLE public.item_category_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, category_id)
);

CREATE INDEX idx_item_cat_assign_item ON public.item_category_assignments(item_id);
CREATE INDEX idx_item_cat_assign_cat ON public.item_category_assignments(category_id);

ALTER TABLE public.item_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized roles can read item category assignments"
ON public.item_category_assignments FOR SELECT TO authenticated
USING (can_access_orders() OR can_access_finance());

CREATE POLICY "managers can insert item category assignments"
ON public.item_category_assignments FOR INSERT TO authenticated
WITH CHECK (can_manage_orders());

CREATE POLICY "managers can delete item category assignments"
ON public.item_category_assignments FOR DELETE TO authenticated
USING (can_manage_orders());