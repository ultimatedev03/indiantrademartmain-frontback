import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';

// ✅ Generic route-guard for Buyer/Vendor/Admin/Employee
// Fix: Buyer dashboard refresh redirecting to Vendor login.
const ProtectedRoute = ({ allowedRoles = [], redirectTo, children }) => {
  const location = useLocation();
  const supa = useAuth();
  const internal = useInternalAuth();

  // ✅ Admin/HR portal currently uses InternalAuthContext (localStorage + RPC)
  const wantsInternal =
    (location.pathname || '').startsWith('/admin') ||
    (location.pathname || '').startsWith('/hr') ||
    allowedRoles.some(r => ['ADMIN', 'HR'].includes(r));

  const loading = wantsInternal ? (internal?.isLoading ?? false) : (supa?.loading ?? false);
  const user = wantsInternal ? internal?.user : supa?.user;
  const role = wantsInternal ? (internal?.user?.role) : (supa?.userRole || supa?.user?.role);
  const isAuthenticated = wantsInternal ? !!internal?.isAuthenticated : !!supa?.user;

  const getDefaultRedirect = () => {
    const host =
      (typeof window !== 'undefined' && window.location?.hostname)
        ? window.location.hostname
        : '';
    const isBuyerSubdomain = host.startsWith('buyer.');
    const isVendorSubdomain = host.startsWith('vendor.');

    // 1) If caller explicitly passed redirectTo, use it
    if (redirectTo) return redirectTo;

    // 2) Infer from current URL prefix
    const p = location.pathname || '';
    if (p.startsWith('/buyer')) return '/buyer/login';
    if (p.startsWith('/vendor')) return '/vendor/login';
    if (p.startsWith('/admin') || p.startsWith('/employee') || p.startsWith('/hr')) return '/admin/login';

    // 3) Infer from allowedRoles (subdomain-safe)
    if (allowedRoles.includes('BUYER')) return isBuyerSubdomain ? '/login' : '/buyer/login';
    if (allowedRoles.includes('VENDOR')) return isVendorSubdomain ? '/login' : '/vendor/login';

    // Default fallback
    return '/buyer/login';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={getDefaultRedirect()} state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0) {
    const hasRole = role ? allowedRoles.includes(role) : false;
    if (!hasRole) return <Navigate to="/unauthorized" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;