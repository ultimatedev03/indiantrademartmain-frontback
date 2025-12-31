import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from '@/modules/vendor/services/vendorApi';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // ✅ combined auth user + vendor profile
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ Refresh user (auth + vendor profile)
  const refreshUser = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!session?.user) {
        setUser(null);
        setIsAuthenticated(false);
        return null;
      }

      const role = session.user.user_metadata?.role || 'VENDOR';

      // vendorApi.auth.me() already merges vendors table info
      const me = await vendorApi.auth.me();

      const finalUser = me ? { ...me, role } : { ...session.user, role };

      setUser(finalUser);
      setIsAuthenticated(true);
      return finalUser;
    } catch (err) {
      console.error('refreshUser failed:', err);
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // ✅ Boot + Auth change listener
  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        if (!mounted) return;
        await refreshUser();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        await refreshUser();
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, [refreshUser]);

  // ✅ Profile update event (Profile page save/upload ke baad header refresh)
  useEffect(() => {
    const onProfileUpdated = () => refreshUser();
    window.addEventListener('vendor_profile_updated', onProfileUpdated);
    return () => window.removeEventListener('vendor_profile_updated', onProfileUpdated);
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, isAuthenticated, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
