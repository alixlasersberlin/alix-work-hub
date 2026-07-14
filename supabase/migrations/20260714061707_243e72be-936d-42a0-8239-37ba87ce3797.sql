
ALTER TABLE public.mobile_push_subscriptions
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS native_token text;

ALTER TABLE public.mobile_push_subscriptions
  DROP CONSTRAINT IF EXISTS mobile_push_subscriptions_platform_check;
ALTER TABLE public.mobile_push_subscriptions
  ADD CONSTRAINT mobile_push_subscriptions_platform_check
  CHECK (platform IN ('web','ios','android'));

CREATE UNIQUE INDEX IF NOT EXISTS mobile_push_subscriptions_user_platform_token_idx
  ON public.mobile_push_subscriptions (user_id, platform, COALESCE(endpoint, native_token));
