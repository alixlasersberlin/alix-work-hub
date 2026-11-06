type NoteProfile = {
  account_status: string;
  is_active: boolean;
  invitation_status: string;
  password_reset_required: boolean;
};

/** Creation only: record visibility and edit/delete permissions remain separate. */
export function canCreateNote(userId: string | undefined, profile: NoteProfile | null, recordAccessible: boolean): boolean {
  return !!userId && recordAccessible && profile?.account_status === 'active'
    && profile.is_active && profile.invitation_status === 'accepted'
    && !profile.password_reset_required;
}