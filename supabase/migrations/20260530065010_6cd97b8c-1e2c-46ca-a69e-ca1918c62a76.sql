alter table public.user_profiles disable trigger enforce_user_profile_update_restrictions;
update public.user_profiles
   set password_reset_required = false,
       invitation_status = 'accepted'
 where email = 'office@alix-lasers.at';
alter table public.user_profiles enable trigger enforce_user_profile_update_restrictions;