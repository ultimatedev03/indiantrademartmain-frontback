
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Auth user object
  const [profile, setProfile] = useState(null); // DB profile object (buyer, vendor, employee)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchProfile(session.user);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Session check error:", error);
        setLoading(false);
      }
    };

    checkSession();

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          await fetchProfile(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (authUser) => {
    try {
      let role = authUser.app_metadata?.role || authUser.user_metadata?.role;
      let fetchedProfile = null;

      // Identify role and fetch profile if not explicitly set in metadata
      if (!role) {
        const { data: emp } = await supabase.from('employees').select('*').eq('user_id', authUser.id).maybeSingle();
        if (emp) {
          role = emp.role;
          fetchedProfile = emp;
        } else {
          const { data: vendor } = await supabase.from('vendors').select('*').eq('user_id', authUser.id).maybeSingle();
          if (vendor) {
            role = 'VENDOR';
            fetchedProfile = vendor;
          } else {
            const { data: buyer } = await supabase.from('buyers').select('*').eq('user_id', authUser.id).maybeSingle();
            if (buyer) {
              role = 'BUYER';
              fetchedProfile = buyer;
            }
          }
        }
      } else {
        // Fetch specific profile based on known role
        let table = '';
        if (['ADMIN', 'HR', 'DATA_ENTRY', 'SUPPORT', 'SALES'].includes(role)) table = 'employees';
        else if (role === 'VENDOR') table = 'vendors';
        else if (role === 'BUYER') table = 'buyers';

        if (table) {
          const { data } = await supabase.from(table).select('*').eq('user_id', authUser.id).maybeSingle();
          fetchedProfile = data;
        }
      }

      setUser({
        ...authUser,
        role: role || 'GUEST',
      });
      
      setProfile(fetchedProfile);

    } catch (error) {
      console.error("Profile fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { data, error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      userId: user?.id,
      buyerId: user?.role === 'BUYER' ? profile?.id : null,
      vendorId: user?.role === 'VENDOR' ? profile?.id : null,
      userRole: user?.role,
      loading,
      signIn,
      signUp,
      logout,
      isAdmin: user?.role === 'ADMIN'
    }}>
      {!loading ? children : (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500 font-medium">Loading Application...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
