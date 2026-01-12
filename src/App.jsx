import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

// This component switches route trees based on subdomain/appType
const AppRoutes = () => {
  const { appType } = useSubdomain();

  // Subdomain: vendor.company.com
  if (appType === 'vendor') {
    return <VendorRoutes />;
  }
  
  // Subdomain: buyer.company.com
  if (appType === 'buyer') {
    return <BuyerRoutes />;
  }

  // Subdomain: admin.company.com
  if (appType === 'admin') {
    return <AdminRoutes />;
  }

  // Subdomain: man.company.com (Management Portal)
  if (appType === 'management') {
    return <AdminRoutes />;
  }

  // Subdomain: dir.company.com or default to directory
  if (appType === 'directory') {
    return <DirectoryRoutes />;
  }

  if (appType === 'career') {
    return <CareerRoutes />;
  }

  // DEFAULT MAIN PORTAL (Localhost or company.com)
  // Handles all routes with prefixes
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
      <Route path="/employee/*" element={<AdminRoutes />} /> {/* Alias for employee routes inside admin routes */}
      <Route path="/career/*" element={<CareerRoutes />} />
      <Route path="/hr/*" element={<AdminRoutes />} />

      {/* DIRECTORY / PUBLIC PAGES (Root) */}
      <Route path="/*" element={<DirectoryRoutes />} />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    locationService.seedLocations().catch(err => console.error("Location seeding failed", err));
  }, []);

  return (
    <>
      <Helmet>
        <title>IndianTradeMart - B2B Marketplace</title>
      </Helmet>
      
      <PageStatusProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SubdomainProvider>
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
          </SubdomainProvider>
        </Router>
      </PageStatusProvider>
      <Toaster />
    </>
  );
}

export default App;