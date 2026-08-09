insert into public.workspaces (code, name, icon, emoji, dashboard_path, sort_order, is_active)
values ('alixdocs','AlixDocs','FolderTree','📁','/w/alixdocs',70,true),
       ('teamkalender','Teamkalender','CalendarDays','📅','/w/teamkalender',80,true)
on conflict (code) do update set is_active = true, name = excluded.name, emoji = excluded.emoji, sort_order = excluded.sort_order;