import React, { createContext, useContext } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';

const BuyerAuthContext = createContext(null);

export const useBuyerAuth = () => {
  const context = useContext(BuyerAuthContext);
  if (!context) {
    throw new Error('useBuyerAuth must be used within a BuyerAuthProvider');
  }
  return context;
};

export const BuyerAuthProvider = ({ children }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await signOut();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    logout,
    // Add any buyer-specific state here
  };

  return (
    <BuyerAuthContext.Provider value={value}>
      {children}
    </BuyerAuthContext.Provider>
  );
};