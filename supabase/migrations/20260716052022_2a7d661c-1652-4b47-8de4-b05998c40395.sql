UPDATE public.alix_applications
SET app_status = 'active', updated_at = now()
WHERE app_key IN ('alix_academy', 'medi_metropole', 'mediapaket')
  AND app_status = 'inactive';