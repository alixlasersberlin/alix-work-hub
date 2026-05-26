INSERT INTO public.roles (name, description)
VALUES ('Österreich', 'Zugriff für den Bereich Österreich')
ON CONFLICT (name) DO NOTHING;