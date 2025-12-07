import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: import('@supabase/supabase-js').User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileHydrated, setProfileHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        promise
          .then((v) => { clearTimeout(t); resolve(v); })
          .catch((e) => { clearTimeout(t); reject(e); });
      });
    };
    // Guard: global timeout fallback to avoid perpetual loading states
    const loadingWatchdog = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthContext] Watchdog: forcing loading=false after timeout');
        setLoading(false);
      }
    }, 20000);

    const adminEmailsRaw = (import.meta.env.VITE_ADMIN_EMAILS || '').trim();
    const adminEmailSet = new Set(
      adminEmailsRaw.length ? adminEmailsRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) : []
    );

    const isAdminOverride = (email?: string | null) => {
      if (!email) return false;
      return adminEmailSet.has(email.toLowerCase());
    };

    // Note: Use a bounded getSession to avoid long initial stalls

    const fetchOrCreateProfile = async (currentUser: import('@supabase/supabase-js').User) => {
      try {
        console.log('[AuthContext] Fetching profile for user', currentUser.id);
        // Use maybeSingle() instead of single() to avoid 406 errors when row doesn't exist
        const { data: profileData, error: selectError } = await supabase
          .from('profiles')
          .select('id, email, full_name, is_admin, created_at, updated_at')
          .eq('id', currentUser.id)
          .maybeSingle();

        console.log('[AuthContext] Profile query result:', { profileData, selectError });

        if (selectError) {
          console.error('[AuthContext] Profile select error', selectError);
          // During maintenance/downtime, treat errors as temporary and allow graceful fallback
          const is400 = (selectError as any)?.code === '400' || selectError.message?.includes('400');
          if (is400) {
            console.warn('[AuthContext] Got 400 error - likely Supabase maintenance, using minimal profile');
            return {
              id: currentUser.id,
              email: currentUser.email,
              full_name: null,
              is_admin: isAdminOverride(currentUser.email),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as Profile;
          }
          // Fallback: build stub if override says admin
          if (isAdminOverride(currentUser.email)) {
            console.warn('[AuthContext] Using admin email override stub profile');
            return {
              id: currentUser.id,
              email: currentUser.email,
              full_name: null,
              is_admin: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as Profile;
          }
          return null;
        }

        // maybeSingle returns null data if no row exists (without error)
        if (!profileData) {
          console.warn('[AuthContext] No profile row found, creating one...');
          const { error: insertError } = await supabase.from('profiles').insert({
            id: currentUser.id,
            user_id: currentUser.id, // Redundant but required by some schema versions
            email: currentUser.email,
            full_name: (currentUser as any).user_metadata?.full_name || null,
            is_admin: isAdminOverride(currentUser.email) || false
          });
          if (insertError) {
            console.error('[AuthContext] Failed to create profile row', insertError);
            // Fallback stub profile if override applies
            if (isAdminOverride(currentUser.email)) {
              return {
                id: currentUser.id,
                email: currentUser.email,
                full_name: null,
                is_admin: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              } as Profile;
            }
            return null;
          }
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('id, email, full_name, is_admin, created_at, updated_at')
            .eq('id', currentUser.id)
            .maybeSingle();
          return newProfile || null;
        }

        console.log('[AuthContext] Returning profile:', profileData);
        // If profile exists but override says admin, ensure is_admin true client-side
        if (profileData && isAdminOverride(currentUser.email) && !profileData.is_admin) {
          console.log('[AuthContext] Elevating profile to admin via override');
          return { ...profileData, is_admin: true };
        }
        return profileData;
      } catch (err) {
        console.error('[AuthContext] Unexpected profile fetch error', err);
        // Last resort stub if admin override
        if (isAdminOverride(currentUser.email)) {
          console.warn('[AuthContext] Using stub due to fetch error + admin override');
          return {
            id: currentUser.id,
            email: currentUser.email,
            full_name: null,
            is_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as Profile;
        }
        return null;
      }
    };

    const init = async () => {
      try {
        // Bound the initial getSession to 10s (generous for slower networks); onAuthStateChange will reconcile later
        const { data } = await withTimeout(supabase.auth.getSession(), 10000);
        if (!mounted) return;
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        // Exit loading early, hydrate profile in background
        if (mounted) setLoading(false);
        if (currentUser) {
          // Dedupe guard: ensure we only hydrate profile once during init
          if (!profileHydrated) {
            const profileData = await fetchOrCreateProfile(currentUser);
            if (mounted) setProfile(profileData);
            if (mounted) setProfileHydrated(true);
          }
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.warn('[AuthContext] getSession timed out/failed; proceeding without blocking UI', e);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        if (!profileHydrated) {
          const profileData = await fetchOrCreateProfile(currentUser);
          setProfile(profileData);
          setProfileHydrated(true);
        }
      } else {
        setProfile(null);
        setProfileHydrated(false);
      }
      // Ensure UI never stays blocked waiting on auth events
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
      clearTimeout(loadingWatchdog);
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_admin, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const adminEmailsRaw = (import.meta.env.VITE_ADMIN_EMAILS || '').trim();
        const adminEmailSet = new Set(
          adminEmailsRaw.length ? adminEmailsRaw.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean) : []
        );
        const isOverride = user.email && adminEmailSet.has(user.email.toLowerCase());

        if (isOverride && !data.is_admin) {
          setProfile({ ...data, is_admin: true });
        } else {
          setProfile(data);
        }
      }
    } catch (error) {
      console.error('[AuthContext] Error refreshing profile:', error);
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthContext] Signing out...');
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[AuthContext] signOut error', e);
    } finally {
      // Hard clear any lingering Supabase session keys
      try {
        Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
      } catch {}
      setUser(null);
      setProfile(null);
      setLoading(false);
      console.log('[AuthContext] Signed out and state cleared');
    }
  };

  const value: AuthContextValue = { user, profile, loading, signOut, refreshProfile };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
