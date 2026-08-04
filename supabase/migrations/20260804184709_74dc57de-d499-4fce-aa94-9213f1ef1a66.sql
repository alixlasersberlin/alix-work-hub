-- ============================================================
-- PHASE 2: fehlende Indizes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm ON public.customers USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_extid_trgm ON public.customers USING gin (external_customer_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc ON public.customers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_contact_name_asc ON public.customers (contact_name);

CREATE INDEX IF NOT EXISTS idx_tickets_device_id ON public.tickets (device_id);
CREATE INDEX IF NOT EXISTS idx_tickets_serial_number ON public.tickets (serial_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON public.tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_cust_created ON public.alixdocs_documents (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_pos ON public.order_items (order_id);

-- ============================================================
-- PHASE 3/4: serverseitige Kundenliste mit Trigram-Suche
-- SECURITY INVOKER -> bestehende RLS-Regeln greifen unverändert.
-- ============================================================
CREATE OR REPLACE FUNCTION public.customers_page(
  _q            text DEFAULT NULL,
  _source       text DEFAULT NULL,
  _letter       text DEFAULT NULL,
  _sort         text DEFAULT 'company_name',
  _dir          text DEFAULT 'asc',
  _limit        int  DEFAULT 50,
  _offset       int  DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  company_name text,
  contact_name text,
  email text,
  phone text,
  source_system text,
  external_customer_id text,
  is_vip boolean,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT c.id, c.company_name, c.contact_name, c.email, c.phone,
           c.source_system, c.external_customer_id,
           COALESCE(c.is_vip, false) AS is_vip, c.created_at
    FROM public.customers c
    WHERE (_source IS NULL OR _source = 'all' OR c.source_system = _source)
      AND (
        _letter IS NULL
        OR (_letter = '#' AND COALESCE(NULLIF(btrim(COALESCE(c.company_name, c.contact_name, '')), ''), 'x') !~ '^[A-Za-z]')
        OR (_letter <> '#' AND upper(btrim(COALESCE(c.company_name, c.contact_name, ''))) LIKE upper(_letter) || '%')
      )
      AND (
        _q IS NULL OR btrim(_q) = ''
        OR c.company_name ILIKE '%' || _q || '%'
        OR c.contact_name ILIKE '%' || _q || '%'
        OR c.email ILIKE '%' || _q || '%'
        OR c.phone ILIKE '%' || _q || '%'
        OR c.external_customer_id ILIKE '%' || _q || '%'
      )
  ), counted AS (
    SELECT count(*) AS n FROM base
  )
  SELECT b.id, b.company_name, b.contact_name, b.email, b.phone,
         b.source_system, b.external_customer_id, b.is_vip, b.created_at,
         (SELECT n FROM counted) AS total_count
  FROM base b
  ORDER BY
    b.is_vip DESC,
    CASE WHEN _dir = 'asc'  AND _sort = 'company_name' THEN lower(b.company_name) END ASC NULLS LAST,
    CASE WHEN _dir = 'desc' AND _sort = 'company_name' THEN lower(b.company_name) END DESC NULLS LAST,
    CASE WHEN _dir = 'asc'  AND _sort = 'contact_name' THEN lower(b.contact_name) END ASC NULLS LAST,
    CASE WHEN _dir = 'desc' AND _sort = 'contact_name' THEN lower(b.contact_name) END DESC NULLS LAST,
    CASE WHEN _dir = 'asc'  AND _sort = 'created_at'   THEN b.created_at END ASC NULLS LAST,
    CASE WHEN _dir = 'desc' AND _sort = 'created_at'   THEN b.created_at END DESC NULLS LAST,
    b.id
  LIMIT GREATEST(COALESCE(_limit, 50), 1)
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.customers_page(text,text,text,text,text,int,int) TO authenticated;

-- Buchstabenleiste: welche Anfangsbuchstaben existieren ueberhaupt
CREATE OR REPLACE FUNCTION public.customers_letters(_source text DEFAULT NULL)
RETURNS TABLE (letter text, n bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN btrim(COALESCE(c.company_name, c.contact_name, '')) ~ '^[A-Za-z]'
             THEN upper(left(btrim(COALESCE(c.company_name, c.contact_name)), 1))
           ELSE '#'
         END AS letter,
         count(*) AS n
  FROM public.customers c
  WHERE (_source IS NULL OR _source = 'all' OR c.source_system = _source)
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.customers_letters(text) TO authenticated;

-- ============================================================
-- PHASE 12: Performance Center (nur Super Admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.perf_slow_queries(_limit int DEFAULT 25)
RETURNS TABLE (
  query text,
  calls bigint,
  mean_ms numeric,
  max_ms numeric,
  total_ms numeric,
  rows_avg numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT s.query::text,
         s.calls,
         round(s.mean_exec_time::numeric, 2),
         round(s.max_exec_time::numeric, 2),
         round(s.total_exec_time::numeric, 2),
         CASE WHEN s.calls > 0 THEN round((s.rows::numeric / s.calls), 1) ELSE 0 END
  FROM extensions.pg_stat_statements s
  WHERE s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%pg_catalog%'
  ORDER BY s.total_exec_time DESC
  LIMIT GREATEST(COALESCE(_limit, 25), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.perf_slow_queries(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.perf_table_stats(_limit int DEFAULT 30)
RETURNS TABLE (
  table_name text,
  live_rows bigint,
  total_bytes bigint,
  total_pretty text,
  seq_scans bigint,
  idx_scans bigint,
  seq_ratio numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT st.relname::text,
         st.n_live_tup,
         pg_total_relation_size(c.oid),
         pg_size_pretty(pg_total_relation_size(c.oid))::text,
         st.seq_scan,
         COALESCE(st.idx_scan, 0),
         CASE WHEN (st.seq_scan + COALESCE(st.idx_scan, 0)) > 0
              THEN round(100.0 * st.seq_scan / (st.seq_scan + COALESCE(st.idx_scan, 0)), 1)
              ELSE 0 END
  FROM pg_stat_user_tables st
  JOIN pg_class c ON c.oid = st.relid
  WHERE c.relnamespace = 'public'::regnamespace
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT GREATEST(COALESCE(_limit, 30), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.perf_table_stats(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.perf_unused_indexes(_limit int DEFAULT 30)
RETURNS TABLE (
  table_name text,
  index_name text,
  index_scans bigint,
  index_pretty text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT si.relname::text,
         si.indexrelname::text,
         COALESCE(si.idx_scan, 0),
         pg_size_pretty(pg_relation_size(si.indexrelid))::text
  FROM pg_stat_user_indexes si
  JOIN pg_class c ON c.oid = si.relid
  WHERE c.relnamespace = 'public'::regnamespace
    AND COALESCE(si.idx_scan, 0) < 50
    AND si.indexrelname NOT LIKE '%_pkey'
    AND si.indexrelname NOT LIKE '%_key'
  ORDER BY pg_relation_size(si.indexrelid) DESC
  LIMIT GREATEST(COALESCE(_limit, 30), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.perf_unused_indexes(int) TO authenticated;