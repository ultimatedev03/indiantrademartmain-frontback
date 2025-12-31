
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const InternalAuthContext = createContext(null);

export const InternalAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for persisted session in localStorage
    const storedUser = localStorage.getItem('itm_admin_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      
      // Call the RPC function we created in the database
      const { data, error } = await supabase.rpc('login_admin', {
        p_email: email,
        p_password: password
      });

      if (error) throw error;

      if (data) {
        setUser(data);
        setIsAuthenticated(true);
        localStorage.setItem('itm_admin_user', JSON.stringify(data));
        toast({ 
          title: "Login Successful", 
          description: `Welcome back, ${data.name}`,
          className: "bg-green-50 text-green-900 border-green-200"
        });
        return data;
      } else {
        throw new Error("Invalid credentials");
      }
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
