
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSubdomain } from '@/contexts/SubdomainContext';

// This component acts as a redirect wrapper to the new combined Profile & KYC page
// CRITICAL FIX: Use absolute path redirect to prevent loops
const Kyc = () => {
  const { resolvePath } = useSubdomain();
  return <Navigate to={`${resolvePath('profile', 'vendor')}?tab=primary`} replace />;
};

export default Kyc;
