insert into public.user_roles(user_id, role_id)
select '7212fdcc-3bc3-4092-85cc-f96c6821c21e', id from public.roles where name='Auftragsverwaltung'
on conflict (user_id, role_id) do nothing;
delete from public.user_menu_grants where user_id='7212fdcc-3bc3-4092-85cc-f96c6821c21e';
insert into public.user_menu_grants(user_id, path) values
('7212fdcc-3bc3-4092-85cc-f96c6821c21e','/verkauf/angebote'),
('7212fdcc-3bc3-4092-85cc-f96c6821c21e','/verkauf/angebot/neu'),
('7212fdcc-3bc3-4092-85cc-f96c6821c21e','/auftraege'),
('7212fdcc-3bc3-4092-85cc-f96c6821c21e','/kunden');