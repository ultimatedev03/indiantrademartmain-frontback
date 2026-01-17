import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';

import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { InternalAuthProvider } from '@/modules/admin/context/InternalAuthContext';
import { SuperAdminProvider } from '@/modules/admin/context/SuperAdminContext';
import { AuthProvider as VendorAuthProvider } from '@/modules/vendor/context/AuthContext';
import { EmployeeAuthProvider } from '@/modules/employee/context/EmployeeAuthContext';
import { SubdomainProvider, useSubdomain } from '@/contexts/SubdomainContext';
import { PageStatusProvider } from '@/contexts/PageStatusContext';
import { locationService } from '@/shared/services/locationService';
import { supabase } from '@/lib/customSupabaseClient';

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

const CONFIG_KEYS_TO_TRY = ['maintenance_mode', 'general_settings'];

const MaintenanceGate = ({ children }) => {
  const { appType } = useSubdomain();
  const [loading, setLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [message, setMessage] = useState('');

  const fetchMaintenance = useCallback(async () => {
    try {
      // Try config_key = 'maintenance_mode' first, fallback to 'general_settings'
      let row = null;

      for (const key of CONFIG_KEYS_TO_TRY) {
        const { data, error } = await supabase
          .from('system_config')
          .select('config_key, maintenance_mode, maintenance_message')
          .eq('config_key', key)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          row = data;
          break;
        }
      }

      // If no row found at all, fail-open
      setIsMaintenance(row?.maintenance_mode === true);
      setMessage(row?.maintenance_message || '');
    } catch (e) {
      console.error('[MaintenanceGate] fetch failed:', e);
      // Fail-open: if config cannot be read, don't block the site
      setIsMaintenance(false);
      setMessage('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaintenance();

    // Poll every 5 seconds so admin toggle effect appears without reload
    const interval = setInterval(fetchMaintenance, 5000);
    return () => clearInterval(interval);
  }, [fetchMaintenance]);

  // Always allow admin/management portals so you can turn maintenance OFF
  if (appType === 'admin' || appType === 'management') return children;

  // Also allow admin routes on main domain (/admin/*)
  const path = window.location.pathname || '';
  if (path.startsWith('/admin') || path.startsWith('/management') || path.startsWith('/migration-tools')) {
    return children;
  }

  // If still loading, don't block (or you can show a loader)
  if (loading) return children;

  if (isMaintenance) {
    return <MaintenancePage message={message} />;
  }

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

      {/* SUB-APP MOUNT POINTS FOR LOCALHOST/MAIN */}
      <Route path="/vendor/*" element={<VendorRoutes />} />
      <Route path="/buyer/*" element={<BuyerRoutes />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/employee/*" element={<AdminRoutes />} />
      <Route path="/career/*" element={<CareerRoutes />} />
      <Route path="/hr/*" element={<AdminRoutes />} />

      {/* DIRECTORY / PUBLIC PAGES (Root) */}
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
                        <AppRoutes />
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
