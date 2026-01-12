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
    role: role || expectedRole, // fallback if role missing
    status,
  };
};

export const InternalAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ If stored session exists but role missing, try to hydrate from DB
  const hydrateStoredUser = async (stored) => {
    try {
      const email = stored?.email;
      if (!email) return stored;

      let role = stored?.role;
      let name = stored?.name;

      // Try employees table first
      const { data: emp } = await supabase
        .from('employees')
        .select('id,user_id,full_name,email,role,status')
        .eq('email', email)
        .maybeSingle();

      if (emp?.role) {
        role = emp.role;
        name = name || emp.full_name;
        return { ...stored, role, name, status: stored.status || emp.status || 'ACTIVE' };
      }

      // Try users table
      const { data: usr } = await supabase
        .from('users')
        .select('id,full_name,email,role,status')
        .eq('email', email)
        .maybeSingle();

      if (usr?.role) {
        role = usr.role;
        name = name || usr.full_name;
        return { ...stored, role, name, status: stored.status || usr.status || 'ACTIVE' };
      }

      return stored;
    } catch (e) {
      console.warn('[InternalAuth] hydrateStoredUser failed:', e);
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
        } catch (e) {
          console.warn('[InternalAuth] bad stored user, clearing.', e);
          localStorage.removeItem('itm_admin_user');
        }
      }
      setIsLoading(false);
    };

    boot();
  }, []);

  /**
   * ✅ login(email, password, expectedRole)
   * expectedRole: 'ADMIN' | 'HR' | etc (PortalLogin will pass)
   */
  const login = async (email, password, expectedRole) => {
    try {
      setIsLoading(true);

      // RPC login
      const { data, error } = await supabase.rpc('login_admin', {
        p_email: email,
        p_password: password
      });

      if (error) throw error;
      if (!data) throw new Error('Invalid credentials');

      // Normalize fields from RPC response
      let normalized = normalizeInternalUser(data, email, expectedRole);

      // ✅ If role still missing, fetch from employees/users
      if (!normalized.role) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id,user_id,full_name,email,role,status')
          .eq('email', email)
          .maybeSingle();

        if (emp?.role) {
          normalized = {
            ...normalized,
            role: emp.role,
            name: normalized.name || emp.full_name,
            status: normalized.status || emp.status || 'ACTIVE',
            employee_id: normalized.employee_id || emp.id,
            user_id: normalized.user_id || emp.user_id,
          };
        } else {
          const { data: usr } = await supabase
            .from('users')
            .select('id,full_name,email,role,status')
            .eq('email', email)
            .maybeSingle();

          if (usr?.role) {
            normalized = {
              ...normalized,
              role: usr.role,
              name: normalized.name || usr.full_name,
              status: normalized.status || usr.status || 'ACTIVE',
              user_id: normalized.user_id || usr.id,
            };
          }
        }
      }

      // If still missing role, last fallback to expectedRole
      if (!normalized.role && expectedRole) {
        normalized.role = expectedRole;
      }

      setUser(normalized);
      setIsAuthenticated(true);
      localStorage.setItem('itm_admin_user', JSON.stringify(normalized));

      toast({
        title: "Login Successful",
        description: `Welcome back, ${normalized.name || 'User'}`,
        className: "bg-green-50 text-green-900 border-green-200"
      });

      return normalized;
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: "Invalid email or password",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('itm_admin_user');
    toast({ title: "Logged Out", description: "You have been logged out successfully." });
  };

  return (
    <InternalAuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </InternalAuthContext.Provider>
  );
};

export const useInternalAuth = () => useContext(InternalAuthContext);
