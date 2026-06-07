CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text NOT NULL,
  request_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup ON public.api_rate_limits (bucket_key, request_at DESC);
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.api_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket text, _max int, _window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int;
BEGIN
  DELETE FROM public.api_rate_limits
   WHERE bucket_key = _bucket
     AND request_at < now() - make_interval(secs => _window_seconds);

  SELECT COUNT(*) INTO _count
    FROM public.api_rate_limits
   WHERE bucket_key = _bucket
     AND request_at > now() - make_interval(secs => _window_seconds);

  IF _count >= _max THEN
    RETURN true;
  END IF;

  INSERT INTO public.api_rate_limits (bucket_key) VALUES (_bucket);
  RETURN false;
END;
$$;