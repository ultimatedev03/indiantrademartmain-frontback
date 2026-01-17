import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const SuperAdminContext = createContext(null);

export const SuperAdminProvider = ({ children }) => {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeRole = (role) => {
    if (!role) return undefined;
    const r = String(role).trim().toUpperCase();
    // accept common variants
    const compact = r.replace(/[^A-Z]/g, '');
    if (compact === 'SUPERADMIN' || compact === 'SUPERUSER' || compact === 'GODMODE') return 'SUPERADMIN';
    return r;
  };

  const normalizeRow = (raw, email) => {
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row || (typeof row === 'object' && Object.keys(row).length === 0)) return null;
    // If the RPC is specifically for superadmin login, treat missing role as SUPERADMIN.
    const role = normalizeRole(row.role || row.user_role || row.userRole || row.type) || 'SUPERADMIN';
    return {
      ...row,
      email: row.email || email,
      role,
    };
  };

  useEffect(() => {
    const stored = localStorage.getItem('itm_superadmin_session');
    if (stored) {
      setSuperAdmin(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const safeEmail = String(email || '').trim();
      console.log(`[SuperAdminAuth] Attempting login for: ${safeEmail}`);

      const { data, error } = await supabase.rpc('login_superadmin', {
        p_email: safeEmail,
        p_password: password
      });

      if (error) {
        console.error("[SuperAdminAuth] RPC Error:", error);
        throw error;
      }

      console.log("[SuperAdminAuth] RPC Response:", data);

      const normalized = normalizeRow(data, safeEmail);
      if (normalized) {
        setSuperAdmin(normalized);
        localStorage.setItem('itm_superadmin_session', JSON.stringify(normalized));
        toast({
          title: "Access Granted",
          description: "Welcome to the Super Admin Console.",
          className: "bg-red-900 text-white border-red-800"
        });
        return true;
      } else {
        console.warn("[SuperAdminAuth] Login failed: Invalid credentials or user not found.");
        throw new Error("Invalid credentials");
      }
    } catch (error) {
      console.error("[SuperAdminAuth] Login Exception:", error);

      const msg = String(error?.message || error || 'Login failed');
      const looksLikeMissingFn = /login_superadmin/i.test(msg) && /(does not exist|not found|function)/i.test(msg);

      toast({
        title: "Access Denied",
        description: looksLikeMissingFn
          ? "DB me login_superadmin RPC missing hai. Supabase me function create/run karna padega."
          : "Invalid credentials. Check console for details.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setSuperAdmin(null);
    localStorage.removeItem('itm_superadmin_session');
    toast({ title: "Session Ended", description: "Secure logout successful." });
  };

  const changePassword = async (newPassword) => {
    if (!superAdmin) return false;
    try {
      const { data, error } = await supabase.rpc('change_superadmin_password', {
        p_id: superAdmin.id,
        p_new_password: newPassword
      });
      
      if (error) throw error;
      
      toast({ title: "Success", description: "Password updated successfully." });
      return true;
    } catch (error) {
      console.error("Password update failed:", error);
      toast({ title: "Error", description: "Could not update password.", variant: "destructive" });
      return false;
    }
  };

  return (
    <SuperAdminContext.Provider value={{ superAdmin, isLoading, login, logout, changePassword }}>
      {children}
    </SuperAdminContext.Provider>
  );
};

export const useSuperAdmin = () => useContext(SuperAdminContext);
