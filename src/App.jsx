import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { InternalAuthProvider } from '@/modules/admin/context/InternalAuthContext';
import { SuperAdminProvider } from '@/modules/admin/context/SuperAdminContext';
import { AuthProvider as VendorAuthProvider } from '@/modules/vendor/context/AuthContext';
import { useAuth as useVendorAuth } from '@/modules/vendor/context/AuthContext';
import { EmployeeAuthProvider } from '@/modules/employee/context/EmployeeAuthContext';
import { SubdomainProvider, useSubdomain } from '@/contexts/SubdomainContext';
import { PageStatusProvider } from '@/contexts/PageStatusContext';
import { locationService } from '@/shared/services/locationService';
import { supabase } from '@/lib/customSupabaseClient';
import AIChatWidget from '@/components/AIChatWidget';

import MaintenancePage from '@/shared/components/MaintenancePage';

// Route Modules
import { VendorRoutes } from '@/modules/vendor/routes';
import { BuyerRoutes } from '@/modules/buyer/routes';
import { AdminRoutes } from '@/modules/admin/routes';
import { DirectoryRoutes } from '@/modules/directory/routes';
import { CareerRoutes } from '@/modules/career/routes';

import ManagementPortal from '@/shared/pages/ManagementPortal';
import SuperAdminLogin from '@/modules/admin/pages/superadmin/SuperAdminLogin';
import SuperAdminDashboard from '@/modules/admin/pages/superadmin/SuperAdminDashboard';
import SuperAdminProtectedRoute from '@/modules/admin/routes/SuperAdminProtectedRoute';
import MigrationTools from '@/shared/pages/MigrationTools';

const MAINTENANCE_KEY = 'maintenance_mode';

/** ✅ Full-screen overlay (blur + message) */
const SuspendedOverlay = ({ message, onSupport, onLogout }) => {
  return (
    <div className="min-h-screen relative">
      {/* Background blur layer */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-md" />

      {/* Foreground card */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600">Account Suspended</h1>
          <p className="text-gray-600 mt-2">
            {message || 'Your account is suspended/terminated. Please contact support to resolve this.'}
          </p>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              type="button"
              onClick={onSupport}
              className="px-4 py-2 rounded-lg bg-[#003D82] text-white font-semibold hover:opacity-95"
            >
              Contact Support
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-lg border font-semibold text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Tip: Support page open karke message send karo, team aapko help karegi.
          </p>
        </div>
      </div>
    </div>
  );
};

/** ✅ Vendor Suspension Gate */
const VendorSuspensionGate = ({ children }) => {
  const { appType } = useSubdomain();
  const { user, loading, logout } = useVendorAuth();
  const [path, setPath] = useState('');

  useEffect(() => {
    setPath(typeof window !== 'undefined' ? window.location.pathname || '' : '');
  }, []);

  // apply only on vendor app (subdomain vendor.* OR /vendor/* routes)
  const isVendorArea =
    appType === 'vendor' ||
    (typeof window !== 'undefined' && (window.location.pathname || '').startsWith('/vendor'));

  if (!isVendorArea) return children;
  if (loading) return children;

  // ✅ Detect suspended/terminated
  const isSuspended =
    user &&
    (
      user.is_active === false ||
      user.status === 'TERMINATED' ||
      user.account_status === 'SUSPENDED' ||
      user.account_status === 'TERMINATED'
    );

  // ✅ Allow support page even if suspended
  const allowPaths = [
    '/vendor/support',
    '/support', // for vendor subdomain sometimes routes are without /vendor prefix
    '/vendor/logout',
    '/logout',
    '/vendor/login',
    '/login',
    '/vendor/verify',
    '/verify',
  ];

  const currentPath = typeof window !== 'undefined' ? (window.location.pathname || '') : path;
  const isAllowed = allowPaths.some((p) => currentPath.startsWith(p));

  if (isSuspended && !isAllowed) {
    const reason =
      user?.suspension_reason ||
      user?.termination_reason ||
      user?.reason ||
      '';

    return (
      <SuspendedOverlay
        message={reason}
        onSupport={() => {
          // if vendor subdomain, support can be /support
          if (appType === 'vendor') window.location.href = '/support';
          else window.location.href = '/vendor/support';
        }}
        onLogout={async () => {
          try {
            if (logout) await logout();
            else await supabase.auth.signOut();
          } catch (e) {
            console.error('Logout failed:', e);
          } finally {
            if (appType === 'vendor') window.location.href = '/login';
            else window.location.href = '/vendor/login';
          }
        }}
      />
    );
  }

  return children;
};

const MaintenanceGate = ({ children }) => {
  const { appType } = useSubdomain();
  const [loading, setLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('system_config')
          .select('maintenance_mode, maintenance_message')
          .eq('config_key', MAINTENANCE_KEY)
          .maybeSingle();

        if (error) throw error;

        setIsMaintenance(data?.maintenance_mode === true);
        setMessage(data?.maintenance_message || '');
      } catch (e) {
        console.error('[MaintenanceGate] fetch failed:', e);
        setIsMaintenance(false);
        setMessage('');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // Always allow admin/management
  if (appType === 'admin' || appType === 'management') return children;

  const path = typeof window !== 'undefined' ? (window.location.pathname || '') : '';
  if (path.startsWith('/admin') || path.startsWith('/management') || path.startsWith('/migration-tools')) {
    return children;
  }

  if (loading) return children;

  if (isMaintenance) return <MaintenancePage message={message} />;

  return children;
};

// This component switches route trees based on subdomain/appType
const AppRoutes = () => {
  const { appType } = useSubdomain();

  if (appType === 'vendor') return <VendorRoutes />;
  if (appType === 'buyer') return <BuyerRoutes />;
  if (appType === 'admin') return <AdminRoutes />;
  if (appType === 'management') return <AdminRoutes />;
  if (appType === 'directory') return <DirectoryRoutes />;
  if (appType === 'career') return <CareerRoutes />;

  return (
    <Routes>
      <Route path="/management" element={<ManagementPortal />} />

      {/* GLOBAL SUPER ADMIN ACCESS */}
      <Route path="/admin/register/superadmin" element={<SuperAdminLogin />} />
      <Route element={<SuperAdminProtectedRoute />}>
        <Route path="/admin/register/superadmin/dashboard" element={<SuperAdminDashboard />} />
      </Route>

      {/* MIGRATION TOOLS */}
      <Route path="/migration-tools" element={<MigrationTools />} />

      {/* SUB-APP MOUNT POINTS */}
      <Route path="/vendor/*" element={<VendorRoutes />} />
      <Route path="/buyer/*" element={<BuyerRoutes />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/employee/*" element={<AdminRoutes />} />
      <Route path="/career/*" element={<CareerRoutes />} />
      <Route path="/hr/*" element={<AdminRoutes />} />

      {/* DIRECTORY / PUBLIC PAGES */}
      <Route path="/*" element={<DirectoryRoutes />} />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    locationService.seedLocations().catch((err) => console.error('Location seeding failed', err));
  }, []);

  return (
    <>
      <Helmet>
        <title>IndianTradeMart - B2B Marketplace</title>
      </Helmet>

      <PageStatusProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SubdomainProvider>
            <MaintenanceGate>
              <AuthProvider>
                <InternalAuthProvider>
                  <VendorAuthProvider>
                    <EmployeeAuthProvider>
                      <SuperAdminProvider>
                        {/* ✅ Vendor suspended gate added here */}
                        <VendorSuspensionGate>
                          <AppRoutes />
                          <AIChatWidget />
                        </VendorSuspensionGate>
                      </SuperAdminProvider>
                    </EmployeeAuthProvider>
                  </VendorAuthProvider>
                </InternalAuthProvider>
              </AuthProvider>
            </MaintenanceGate>
          </SubdomainProvider>
        </Router>
      </PageStatusProvider>

      <Toaster />
    </>
  );
}

export default App;
