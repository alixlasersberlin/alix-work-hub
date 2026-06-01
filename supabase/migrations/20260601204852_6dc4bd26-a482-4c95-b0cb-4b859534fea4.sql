-- ============================================================
-- Reviews-Modul (Kundenbewertungen)
-- Neue, eigenständige Tabellen; keine Änderung an Bestandsschemata.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE,
  customer_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  order_number TEXT,
  product_name TEXT,
  delivery_date TIMESTAMPTZ,

  rating_delivery SMALLINT CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_driver_friendliness SMALLINT CHECK (rating_driver_friendliness BETWEEN 1 AND 5),
  training_answer TEXT CHECK (training_answer IN ('ja','teilweise','nein')),
  rating_training_text TEXT,
  improvement_text TEXT,

  review_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ,
  invitation_sent_at TIMESTAMPTZ,
  invitation_sent_by UUID,
  invitation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (invitation_status IN ('pending','sent','failed','resent')),

  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','submitted','archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON public.reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_invitation_status ON public.reviews(invitation_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten Nutzer dürfen Bewertungen sehen
CREATE POLICY "reviews_select_authenticated"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

-- Nur Super Admin darf einfügen/ändern/löschen
CREATE POLICY "reviews_insert_super_admin"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "reviews_update_super_admin"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "reviews_delete_super_admin"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- review_email_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  order_id UUID,
  customer_email TEXT,
  sent_by UUID,
  sent_type TEXT NOT NULL CHECK (sent_type IN ('automatic','manual')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_email_logs_review ON public.review_email_logs(review_id);
CREATE INDEX IF NOT EXISTS idx_review_email_logs_order ON public.review_email_logs(order_id);

GRANT SELECT, INSERT ON public.review_email_logs TO authenticated;
GRANT ALL ON public.review_email_logs TO service_role;

ALTER TABLE public.review_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_email_logs_select_authenticated"
  ON public.review_email_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "review_email_logs_insert_super_admin"
  ON public.review_email_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "review_email_logs_delete_super_admin"
  ON public.review_email_logs FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));
