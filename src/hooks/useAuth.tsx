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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: string[];
  loading: boolean;
  blockReason: AccountBlockReason;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: boolean;
  isOtpVerified: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getBlockReason(profile: UserProfile | null): AccountBlockReason {
  if (!profile) return null;
  if (profile.account_status !== 'active' || !profile.is_active) return 'inactive';
  if (profile.invitation_status !== 'accepted') return 'not_accepted';
  if (profile.password_reset_required) return 'password_reset';
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(async () => {
          await fetchProfile(session.user.id);
          await fetchRoles(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(() => {
          fetchRoles(session.user.id).then(() => {
            setLoading(false);
          });
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRoles(user.id);
    }
  }, [user]);

  const hasRole = (role: string) => roles.includes(role);
  const hasAnyRole = (checkRoles: string[]) => checkRoles.some(r => roles.includes(r));
  const isAdmin = hasRole('Super Admin') || hasRole('Admin');
  const blockReason = getBlockReason(profile);
  // 2FA is disabled — always verified
  const isOtpVerified = true;

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading, blockReason,
      signIn, signOut,
      hasRole, hasAnyRole, isAdmin, isOtpVerified, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
