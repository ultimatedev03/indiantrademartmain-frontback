
import React, { createContext, useContext, useState, useEffect } from 'react';
import { employeeApi } from '@/modules/employee/services/employeeApi';
import { toast } from '@/components/ui/use-toast';

const EmployeeAuthContext = createContext(null);

export const EmployeeAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedUser = localStorage.getItem('itm_employee_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // simple validation check or re-fetch profile could go here
          setUser(parsedUser);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Session check failed", e);
        localStorage.removeItem('itm_employee_user');
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (email, password) => {
    try {
      // In a real app, this calls the backend API
      const response = await employeeApi.auth.login(email, password);
      
      if (response && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
        localStorage.setItem('itm_employee_user', JSON.stringify(response.user));
        toast({ 
          title: "Welcome back!", 
          description: `Logged in as ${response.user.role.replace('_', ' ')}`,
          className: "bg-green-50 border-green-200"
        });
        return response.user;
      }
      return null;
    } catch (error) {
      console.error("Login Error:", error);
      toast({ 
        title: "Login Failed", 
        description: error.message || "Invalid credentials. Please try again.", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('itm_employee_user');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  return (
    <EmployeeAuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
};

export const useEmployeeAuth = () => useContext(EmployeeAuthContext);
