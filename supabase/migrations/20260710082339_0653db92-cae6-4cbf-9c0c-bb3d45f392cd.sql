-- Verhindert doppelte reguläre Produktionsbestellungen für denselben Auftrag.
-- Reklamationen (is_reclamation = true) sind bewusst ausgenommen, da für einen
-- Auftrag mehrere Reklamations-Bestellungen entstehen dürfen.
CREATE UNIQUE INDEX IF NOT EXISTS production_orders_unique_regular_per_order
  ON public.production_orders (order_id)
  WHERE is_reclamation = false;