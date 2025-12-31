
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const SuperAdminContext = createContext(null);

export const SuperAdminProvider = ({ children }) => {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
      console.log(`[SuperAdminAuth] Attempting login for: ${email}`);

      const { data, error } = await supabase.rpc('login_superadmin', {
        p_email: email,
        p_password: password
      });

      if (error) {
        console.error("[SuperAdminAuth] RPC Error:", error);
        throw error;
      }

      console.log("[SuperAdminAuth] RPC Response:", data);

      if (data) {
        setSuperAdmin(data);
        localStorage.setItem('itm_superadmin_session', JSON.stringify(data));
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
      toast({
        title: "Access Denied",
        description: "Invalid credentials. Check console for details.",
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
