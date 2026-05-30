create or replace function public.complete_password_setup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.user_profiles
     set password_reset_required = false,
         invitation_status = 'accepted'
   where id = auth.uid();
end;
$$;

grant execute on function public.complete_password_setup() to authenticated;