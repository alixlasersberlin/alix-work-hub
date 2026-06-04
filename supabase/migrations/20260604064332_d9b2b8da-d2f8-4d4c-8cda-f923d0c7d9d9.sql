-- Restrict column-level SELECT on reviews.review_token so it is no longer
-- exposed to any authenticated client (including Auftragsverwaltung/Admin).
-- The token is a bearer secret and is only consumed server-side via the
-- service role inside edge functions (submit-review, get-review-context,
-- send-review-invitation).

REVOKE SELECT ON public.reviews FROM authenticated;
REVOKE SELECT ON public.reviews FROM anon;

-- Re-grant SELECT on every column EXCEPT review_token to authenticated.
GRANT SELECT (
  id,
  order_id,
  customer_id,
  customer_name,
  customer_email,
  order_number,
  product_name,
  delivery_date,
  rating_delivery,
  rating_driver_friendliness,
  training_answer,
  rating_training_text,
  improvement_text,
  token_expires_at,
  invitation_sent_at,
  invitation_sent_by,
  invitation_status,
  submitted_at,
  status,
  created_at,
  updated_at,
  closed_at,
  closed_by,
  closed_reason
) ON public.reviews TO authenticated;

-- Keep insert/update/delete privileges intact (RLS still gates them).
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- Service role retains full access (used by edge functions).
GRANT ALL ON public.reviews TO service_role;