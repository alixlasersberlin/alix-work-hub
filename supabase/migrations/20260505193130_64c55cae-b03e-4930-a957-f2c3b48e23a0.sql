-- Hierarchie: Jeder Admin erhält automatisch zusätzlich die Rolle "Super Admin"
INSERT INTO public.user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM public.roles WHERE name = 'Super Admin')
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE r.name = 'Admin'
ON CONFLICT (user_id, role_id) DO NOTHING;