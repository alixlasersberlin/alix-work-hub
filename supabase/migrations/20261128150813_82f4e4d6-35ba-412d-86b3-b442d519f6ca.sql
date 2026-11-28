CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket text, _max integer, _window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
 -- Dedicated SMS quota may only be changed by the protected SMS reservation.
 IF left(_bucket,7) = 'sms:v1:' THEN RETURN true; END IF;
 DELETE FROM public.api_rate_limits WHERE bucket_key = _bucket AND request_at < now() - make_interval(secs => _window_seconds);
 SELECT COUNT(*) INTO _count FROM public.api_rate_limits WHERE bucket_key = _bucket AND request_at > now() - make_interval(secs => _window_seconds);
 IF _count >= _max THEN RETURN true; END IF;
 INSERT INTO public.api_rate_limits (bucket_key) VALUES (_bucket);
 RETURN false;
END; $$;