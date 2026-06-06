
-- Felder für Bestellvorschläge aus Reparaturaufträgen
ALTER TABLE public.repair_spare_parts
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_repair_spare_parts_status ON public.repair_spare_parts(status);
CREATE INDEX IF NOT EXISTS idx_repair_spare_parts_ticket_id ON public.repair_spare_parts(ticket_id);

-- Zusätzliche RLS für Rolle "Bestellwesen": lesen + Status pflegen
CREATE POLICY "repair_spare_parts bestellwesen select"
  ON public.repair_spare_parts FOR SELECT
  USING (has_role('Bestellwesen'));

CREATE POLICY "repair_spare_parts bestellwesen update"
  ON public.repair_spare_parts FOR UPDATE
  USING (has_role('Bestellwesen'))
  WITH CHECK (has_role('Bestellwesen'));
