UPDATE public.alix_applications
SET
  base_url = 'https://app.alixwork.de',
  redirect_uris = ARRAY[
    'https://app.alixwork.de/sso/callback',
    'https://alixwork.de/sso/callback',
    'https://www.alixwork.de/sso/callback',
    'https://alix-pro-hub.lovable.app/sso/callback',
    'https://id-preview--13914134-4b95-4f3f-a064-71f725c7d887.lovable.app/sso/callback'
  ],
  allowed_origins = ARRAY[
    'https://app.alixwork.de',
    'https://alixwork.de',
    'https://www.alixwork.de',
    'https://alix-pro-hub.lovable.app',
    'https://id-preview--13914134-4b95-4f3f-a064-71f725c7d887.lovable.app'
  ],
  app_status = 'active',
  updated_at = now()
WHERE app_key = 'alixwork_customer';