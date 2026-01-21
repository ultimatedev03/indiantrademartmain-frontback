import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const InternalAuthContext = createContext(null);

const pickFirst = (...vals) => {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

const normalizeInternalUser = (raw, email, expectedRole) => {
  const row = Array.isArray(raw) ? raw[0] : raw;

  const role = pickFirst(
    row?.role,
    row?.user_role,
    row?.userRole,
    row?.role_name,
    row?.roleName,
    row?.employee_role,
    row?.employeeRole,
    row?.type
  );

  const name = pickFirst(
    row?.name,
    row?.full_name,
    row?.fullName,
    row?.employee_name,
    row?.employeeName,
    row?.employee_full_name,
    row?.display_name,
    row?.displayName
  );

  const status = pickFirst(
    row?.status,
    row?.account_status,
    row?.accountStatus
  ) || 'ACTIVE';

  const id = pickFirst(
    row?.id,
    row?.user_id,
    row?.userId,
    row?.employee_id,
    row?.employeeId
  );

  return {
    ...row,
    id,
    email: pickFirst(row?.email, email),
    name: name || (email ? email.split('@')[0] : 'User'),
    role: role || expectedRole,
    status,
  };
};

export const InternalAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateStoredUser = async (stored) => {
    try {
      const email = stored?.email;
      if (!email) return stored;

      const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (emp) {
        return { ...stored, ...normalizeInternalUser(emp, email, stored?.role) };
      }

      const { data: usr } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (usr) {
        return { ...stored, ...normalizeInternalUser(usr, email, stored?.role) };
      }

      return stored;
    } catch {
      return stored;
    }
  };

  useEffect(() => {
    const boot = async () => {
      const storedUser = localStorage.getItem('itm_admin_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const hydrated = await hydrateStoredUser(parsed);
          setUser(hydrated);
          setIsAuthenticated(true);
          localStorage.setItem('itm_admin_user', JSON.stringify(hydrated));
        } catch {
          localStorage.removeItem('itm_admin_user');
        }
      }
      setIsLoading(false);
    };
    boot();
  }, []);

  /**
   * 🔐 FIXED LOGIN
   */
  const login = async (email, password, expectedRole) => {
    try {
      setIsLoading(true);

      // 🚨 IMPORTANT: kill any cached session
      await supabase.auth.signOut();

      // ✅ 1. STRICT PASSWORD VALIDATION
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError || !authData?.user) {
        throw new Error('Invalid credentials');
      }

      // ✅ 2. YOUR EXISTING RPC (ROLE / ACCESS CHECK)
      const { data, error } = await supabase.rpc('login_admin', {
        p_email: email,
        p_password: password,
      });

      if (error || !data) {
        // rollback auth session
        await supabase.auth.signOut();
        throw new Error('Unauthorized');
      }

      let normalized = normalizeInternalUser(data, email, expectedRole);

      if (!normalized.role && expectedRole) {
        normalized.role = expectedRole;
      }

      setUser(normalized);
      setIsAuthenticated(true);
      localStorage.setItem('itm_admin_user', JSON.stringify(normalized));

      toast({
        title: 'Login Successful',
        description: `Welcome back, ${normalized.name || 'User'}`,
        className: 'bg-green-50 text-green-900 border-green-200',
      });

      return normalized;
    } catch (error) {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('itm_admin_user');

      toast({
        title: 'Login Failed',
        description: 'Invalid email or password',
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('itm_admin_user');
    toast({ title: 'Logged Out', description: 'You have been logged out successfully.' });
  };

  return (
    <InternalAuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </InternalAuthContext.Provider>
  );
};

export const useInternalAuth = () => useContext(InternalAuthContext);