INSERT INTO public.roles (name, description)
SELECT 'FIBU LIGHT', 'Vereinfachte Offene-Posten-Oberflaeche'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'FIBU LIGHT');

INSERT INTO public.user_roles (user_id, role_id)
SELECT p.id, r.id
FROM public.user_profiles p
CROSS JOIN public.roles r
WHERE p.email = 'k.trinh@alix-operation.de'
  AND r.name = 'FIBU LIGHT'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role_id = r.id
  );