-- Phase 22: Snapshot-Update-Recht für Angebots-/Auftragsverknüpfung
GRANT UPDATE ON public.catalog_item_snapshots TO authenticated;

DROP POLICY IF EXISTS "cat_snap_update_link" ON public.catalog_item_snapshots;
CREATE POLICY "cat_snap_update_link"
ON public.catalog_item_snapshots
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.catalog_can_edit()
  OR public.has_role('Super Admin'::text)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.catalog_can_edit()
  OR public.has_role('Super Admin'::text)
);

-- Index für schnelle Rückwärts-Suche „welche Snapshots gehören zu dieser Nummer?"
CREATE INDEX IF NOT EXISTS idx_cat_snap_used_in
  ON public.catalog_item_snapshots(used_in_type, used_in_id);