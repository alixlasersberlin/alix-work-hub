
DROP POLICY IF EXISTS "repair_spare_parts bestellwesen select" ON public.repair_spare_parts;
DROP POLICY IF EXISTS "repair_spare_parts bestellwesen update" ON public.repair_spare_parts;

CREATE POLICY "repair_spare_parts bestellwesen select"
ON public.repair_spare_parts FOR SELECT
TO authenticated
USING (has_role('Bestellwesen'));

CREATE POLICY "repair_spare_parts bestellwesen update"
ON public.repair_spare_parts FOR UPDATE
TO authenticated
USING (has_role('Bestellwesen'))
WITH CHECK (has_role('Bestellwesen'));
