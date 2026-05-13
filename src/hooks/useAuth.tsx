import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  account_status: string;
  invitation_status: string;
  is_active: boolean;
  password_reset_required: boolean;
  phone_number: string | null;
}

export type AccountBlockReason = 'inactive' | 'not_accepted' | 'password_reset' | null;
export type MfaState = 'unknown' | 'not_enrolled' | 'challenge_required' | 'verified';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: string[];
  loading: boolean;
  blockReason: AccountBlockReason;
  mfaState: MfaState;
  refreshMfaState: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: boolean;
  isOtpVerified: boolean;
  refreshProfile: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: false,
  blockReason: null,
  mfaState: 'unknown',
  refreshMfaState: async () => {},
  signIn: async () => ({ error: new Error('AuthProvider ist nicht initialisiert') }),
  signOut: async () => {},
  hasRole: () => false,
  hasAnyRole: () => false,
  isAdmin: false,
  isOtpVerified: true,
  refreshProfile: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

function getBlockReason(profile: UserProfile | null): AccountBlockReason {
  if (!profile) return null;
  if (profile.account_status !== 'active' || !profile.is_active) return 'inactive';
  if (profile.invitation_status !== 'accepted') return 'not_accepted';
  if (profile.password_reset_required) return 'password_reset';
  return null;
}

const MFA_TAB_KEY = 'alixwork.mfa_verified_tab';

export function markMfaVerifiedThisTab() {
  try { sessionStorage.setItem(MFA_TAB_KEY, '1'); } catch { /* ignore */ }
}

export function clearMfaTabMarker() {
  try { sessionStorage.removeItem(MFA_TAB_KEY); } catch { /* ignore */ }
}

function isMfaVerifiedThisTab() {
  try { return sessionStorage.getItem(MFA_TAB_KEY) === '1'; } catch { return false; }
}

async function computeMfaState(): Promise<MfaState> {
  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = (factorsData?.totp ?? []).filter((f: any) => f.status === 'verified');
    if (verifiedTotp.length === 0) return 'not_enrolled';
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Pflicht-TOTP: AAL2 alleine reicht nicht — der Tab muss in dieser Session
    // explizit verifiziert worden sein, sonst wird ein neuer Challenge erzwungen.
    if (aalData?.currentLevel === 'aal2' && isMfaVerifiedThisTab()) return 'verified';
    return 'challenge_required';
  } catch {
    return 'unknown';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mfaState, setMfaState] = useState<MfaState>('unknown');

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, account_status, invitation_status, is_active, password_reset_required, phone_number')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
    return data;
  }

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', userId);

    if (data) {
      const roleNames = data.map((r: any) => r.roles?.name).filter(Boolean);
      setRoles(roleNames);
    }
  }

  const refreshMfaState = useCallback(async () => {
    setMfaState(await computeMfaState());
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Bei jedem frischen Sign-In bzw. Sign-Out muss der TOTP erneut verlangt werden.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        clearMfaTabMarker();
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(async () => {
          await fetchProfile(session.user.id);
          await fetchRoles(session.user.id);
          setMfaState(await computeMfaState());
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setMfaState('unknown');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
          computeMfaState(),
        ]).then(([, , mfa]) => {
          setMfaState(mfa);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    clearMfaTabMarker();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    clearMfaTabMarker();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setMfaState('unknown');
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRoles(user.id);
    }
  }, [user]);

  // Idle-Auto-Logout nach 20 Minuten Inaktivität
  useEffect(() => {
    if (!user) return;
    const IDLE_MS = 60 * 60 * 1000;
    let timer: number | undefined;

    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        try {
          // toast nur best-effort, dynamic import um Zyklen zu vermeiden
          const { toast } = await import('sonner');
          toast.warning('Automatisch abgemeldet wegen Inaktivität (20 Min.)');
        } catch { /* ignore */ }
        await signOut();
      }, IDLE_MS);
    };

    const events: string[] = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel',
    ];
    const handler = () => {
      if (document.visibilityState === 'hidden') return;
      reset();
    };
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true } as any));
    document.addEventListener('visibilitychange', handler);
    reset();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, handler));
      document.removeEventListener('visibilitychange', handler);
    };
  }, [user]);

  const hasRole = (role: string) => roles.includes(role);
  const hasAnyRole = (checkRoles: string[]) => checkRoles.some(r => roles.includes(r));
  const isAdmin = hasRole('Super Admin') || hasRole('Admin');
  const blockReason = getBlockReason(profile);
  const isOtpVerified = mfaState === 'verified';

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading, blockReason,
      mfaState, refreshMfaState,
      signIn, signOut,
      hasRole, hasAnyRole, isAdmin, isOtpVerified, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
