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
  otp_channel: string;
  last_otp_verified_at: string | null;
}

export type AccountBlockReason = 'inactive' | 'not_accepted' | 'password_reset' | null;

export type OtpState = 'none' | 'sending' | 'pending' | 'verified' | 'blocked' | 'error';

interface OtpChallenge {
  challenge_id: string;
  channel: string;
  destination_hint: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: string[];
  loading: boolean;
  blockReason: AccountBlockReason;
  otpState: OtpState;
  otpChallenge: OtpChallenge | null;
  otpError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  sendOtp: (reason?: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<boolean>;
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

function isOtpRecent(profile: UserProfile | null): boolean {
  if (!profile?.last_otp_verified_at) return false;
  const verifiedAt = new Date(profile.last_otp_verified_at).getTime();
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  return verifiedAt > twelveHoursAgo;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpState, setOtpState] = useState<OtpState>('none');
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, account_status, invitation_status, is_active, password_reset_required, phone_number, otp_channel, last_otp_verified_at')
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
          const p = await fetchProfile(session.user.id);
          await fetchRoles(session.user.id);
          // Check if OTP is already recent
          if (p && isOtpRecent(p)) {
            setOtpState('verified');
          }
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setOtpState('none');
        setOtpChallenge(null);
        setOtpError(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then((p) => {
          fetchRoles(session.user.id).then(() => {
            if (p && isOtpRecent(p)) {
              setOtpState('verified');
            }
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
    setOtpState('none');
    setOtpChallenge(null);
    setOtpError(null);
  };

  const sendOtp = useCallback(async (reason = 'login') => {
    setOtpState('sending');
    setOtpError(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp-challenge', {
        body: { reason },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.blocked) {
          setOtpState('blocked');
          setOtpError(data.error);
          return;
        }
        throw new Error(data.error);
      }
      setOtpChallenge({
        challenge_id: data.challenge_id,
        channel: data.channel,
        destination_hint: data.destination_hint,
        expires_at: data.expires_at,
      });
      setOtpState('pending');
    } catch (err: any) {
      setOtpState('error');
      setOtpError(err?.message || 'OTP konnte nicht gesendet werden');
    }
  }, []);

  const verifyOtp = useCallback(async (code: string): Promise<boolean> => {
    if (!otpChallenge) return false;
    setOtpError(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp-challenge', {
        body: { challenge_id: otpChallenge.challenge_id, otp: code },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.blocked) {
          setOtpState('blocked');
          setOtpError(data.error);
          return false;
        }
        setOtpError(data.error);
        return false;
      }
      setOtpState('verified');
      // Refresh profile to get updated last_otp_verified_at
      if (user) await fetchProfile(user.id);
      return true;
    } catch (err: any) {
      setOtpError(err?.message || 'OTP-Verifikation fehlgeschlagen');
      return false;
    }
  }, [otpChallenge, user]);

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
  const isOtpVerified = otpState === 'verified';

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading, blockReason,
      otpState, otpChallenge, otpError,
      signIn, signOut, sendOtp, verifyOtp,
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
