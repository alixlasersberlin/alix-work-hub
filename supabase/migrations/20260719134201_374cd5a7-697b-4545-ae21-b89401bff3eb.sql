DROP POLICY IF EXISTS alixdocs_links_read_authenticated ON public.alixdocs_document_links;
CREATE POLICY alixdocs_links_read_internal ON public.alixdocs_document_links
FOR SELECT TO authenticated
USING (
  has_role('Admin'::text) OR has_role('Super Admin'::text)
  OR has_role('Order'::text) OR has_role('Finance'::text)
  OR has_role('Kundenservice'::text) OR has_role('Technik'::text)
  OR has_role('QM'::text) OR has_role('Österreich'::text)
  OR has_role('Tourenplanung'::text)
);