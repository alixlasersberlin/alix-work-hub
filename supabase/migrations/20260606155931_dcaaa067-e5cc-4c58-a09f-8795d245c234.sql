
-- Verknüpfung Ticket <-> Reparaturauftrag
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS repair_order_id uuid REFERENCES public.repair_orders(id) ON DELETE SET NULL;

ALTER TABLE public.repair_orders
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_repair_order_id ON public.tickets(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_ticket_id ON public.repair_orders(ticket_id);
