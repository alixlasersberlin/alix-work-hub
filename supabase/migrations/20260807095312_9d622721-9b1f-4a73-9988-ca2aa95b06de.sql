CREATE OR REPLACE FUNCTION public.delivery_rating_token_valid(_token text, _appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_confirmation_tokens t
    WHERE t.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
      AND COALESCE(t.revoked, false) = false
      AND (t.expires_at IS NULL OR t.expires_at > now())
      AND (_appointment_id IS NULL OR t.appointment_id = _appointment_id)
  );
$$;

REVOKE ALL ON FUNCTION public.delivery_rating_token_valid(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delivery_rating_token_valid(text, uuid) TO anon, authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_ratings_token ON public.delivery_ratings (token);

DROP POLICY IF EXISTS ratings_public_insert ON public.delivery_ratings;

CREATE POLICY ratings_public_insert ON public.delivery_ratings
FOR INSERT TO anon, authenticated
WITH CHECK (
  token IS NOT NULL
  AND length(token) >= 20
  AND public.delivery_rating_token_valid(token, appointment_id)
  AND rating BETWEEN 1 AND 5
  AND (punctuality IS NULL OR punctuality BETWEEN 1 AND 5)
  AND (friendliness IS NULL OR friendliness BETWEEN 1 AND 5)
  AND (instruction_quality IS NULL OR instruction_quality BETWEEN 1 AND 5)
  AND (comment IS NULL OR length(comment) <= 2000)
);