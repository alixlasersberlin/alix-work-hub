
-- Doppelte Trigram-Indizes auf customers entfernen (Schreiblast halbieren)
DROP INDEX IF EXISTS public.idx_customers_company_trgm;
DROP INDEX IF EXISTS public.idx_customers_contact_trgm;

-- Suchspalten Aufträge
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id_trgm ON public.orders USING gin (external_order_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_internal_number_trgm ON public.orders USING gin (internal_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_case_number_trgm ON public.orders USING gin (case_number gin_trgm_ops);

-- Rechnungen: Kundenname-Suche
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_customer_name_trgm ON public.zoho_invoices USING gin (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_reference_trgm ON public.zoho_invoices USING gin (reference_number gin_trgm_ops);

-- Lagergeräte: Seriennummer / Modell
CREATE INDEX IF NOT EXISTS idx_lager_devices_serial_trgm ON public.lager_devices USING gin (serial_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lager_devices_model_trgm ON public.lager_devices USING gin (model_name gin_trgm_ops);

-- Artikelsuche zusätzlich über Beschreibung (Angebotserstellung)
CREATE INDEX IF NOT EXISTS idx_zoho_items_description_trgm ON public.zoho_items USING gin (description gin_trgm_ops);
