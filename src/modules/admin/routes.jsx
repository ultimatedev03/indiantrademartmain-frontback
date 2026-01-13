import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import PortalLayout from '@/shared/layouts/PortalLayout';
import EmployeeLayout from '@/modules/employee/layouts/EmployeeLayout';
import { useSubdomain } from '@/contexts/SubdomainContext';

// Admin Pages
import AdminDashboard from '@/modules/admin/pages/Dashboard';
import AdminVendors from '@/modules/admin/pages/Vendors';
import AdminVendorProducts from '@/modules/admin/pages/VendorProducts';
import Staff from '@/modules/admin/pages/Staff';
import AuditLogs from '@/modules/admin/pages/AuditLogs';
import AdminSettings from '@/modules/admin/pages/Settings';
import KYCApproval from '@/modules/admin/pages/KYCApproval';
import SuperAdminLogin from '@/modules/admin/pages/superadmin/SuperAdminLogin';
import SuperAdminDashboard from '@/modules/admin/pages/superadmin/SuperAdminDashboard';
import SuperAdminProtectedRoute from '@/modules/admin/routes/SuperAdminProtectedRoute';



// Reuse Employee Support pages for Admin
import SupportTickets from '@/modules/employee/pages/support/Tickets';

// HR Pages
import HrDashboard from '@/modules/hr/pages/Dashboard';
import HrStaff from '@/modules/hr/pages/Staff';

// Employee Pages
import EmployeeLogin from '@/modules/employee/pages/auth/Login';
import DataEntryDashboard from '@/modules/employee/pages/dataentry/Dashboard';
import DataEntryLocations from '@/modules/employee/pages/dataentry/LocationsFixed';
import DataEntryVendors from '@/modules/employee/pages/dataentry/Vendors';
import DataEntryVendorProducts from '@/modules/employee/pages/dataentry/VendorProducts';
import DataEntryAddProduct from '@/modules/employee/pages/dataentry/AddProduct';
import DataEntryCategories from '@/modules/employee/pages/dataentry/CategoriesFixed';
import DataEntryCsvUpload from '@/modules/employee/pages/dataentry/CsvUpload';
import DataEntryBulkImport from '@/modules/employee/pages/dataentry/BulkImport';
import DataEntryVendorOnboarding from '@/modules/employee/pages/dataentry/VendorOnboarding';
import DataEntryRecords from '@/modules/employee/pages/dataentry/DataEntryRecords';
import KycApprovals from '@/modules/employee/pages/support/KycApprovals';
import SupportDashboard from '@/modules/employee/pages/support/Dashboard';
import SalesDashboard from '@/modules/employee/pages/sales/Dashboard';
import SalesLeads from '@/modules/employee/pages/sales/Leads';
import PricingRules from '@/modules/employee/pages/sales/PricingRules';

import PortalLogin from '@/shared/pages/PortalLogin';
import { ShieldCheck, Users } from 'lucide-react';

const LoginRouter = () => {
  const location = useLocation();
  const { appType } = useSubdomain();
  const p = location.pathname || '';

  // ✅ MAIN MODE (localhost) prefixes
  if (p.startsWith('/employee')) {
    return <EmployeeLogin />;
  }

  if (p.startsWith('/hr')) {
    return (
      <PortalLogin
        portalName="HR Portal"
        colorScheme="emerald"
        defaultEmail="harsh@hr.com"
        icon={Users}
      />
    );
  }

  if (p.startsWith('/admin')) {
    return (
      <PortalLogin
        portalName="Admin Portal"
        colorScheme="blue"
        defaultEmail="aditi@admin.com"
        icon={ShieldCheck}
      />
    );
  }

  // ✅ SUBDOMAIN MODE (admin.company.com / man.company.com)
  if (appType === 'admin' || appType === 'management') {
    return (
      <PortalLogin
        portalName="Admin Portal"
        colorScheme="blue"
        defaultEmail="aditi@admin.com"
        icon={ShieldCheck}
      />
    );
  }

  // fallback
  return <EmployeeLogin />;
};

export const AdminRoutes = () => {
  return (
    <Routes>
      {/* ✅ Correct login route for /admin/login, /employee/login, /hr/login */}
      <Route path="login" element={<LoginRouter />} />

      {/* Superadmin */}
      <Route path="superadmin/login" element={<SuperAdminLogin />} />
      <Route element={<SuperAdminProtectedRoute />}>
        <Route path="superadmin/dashboard" element={<SuperAdminDashboard />} />
      </Route>

      {/* Admin */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<PortalLayout role="ADMIN" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />

          {/* Vendors (business management) */}
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="vendors/:vendorId/products" element={<AdminVendorProducts />} />

          <Route path="tickets" element={<SupportTickets />} />

          {/* KYC Approvals (verification) */}
          <Route path="kyc" element={<KYCApproval />} />

          <Route path="staff" element={<Staff />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      {/* HR */}
      <Route element={<ProtectedRoute allowedRoles={['HR']} />}>
        <Route element={<PortalLayout role="HR" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HrDashboard />} />
          <Route path="staff" element={<HrStaff />} />
        </Route>
      </Route>

      {/* Employees - Data Entry */}
      <Route path="dataentry" element={<EmployeeLayout allowedRole="DATA_ENTRY" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DataEntryDashboard />} />
        <Route path="categories" element={<DataEntryCategories />} />
        <Route path="categories/upload" element={<DataEntryCsvUpload />} />
        <Route path="locations" element={<DataEntryLocations />} />
        <Route path="bulk-import" element={<DataEntryBulkImport />} />
        <Route path="vendor-onboarding" element={<DataEntryVendorOnboarding />} />
        <Route path="records" element={<DataEntryRecords />} />
        <Route path="vendors" element={<DataEntryVendors />} />
        <Route path="vendors/:vendorId" element={<DataEntryVendorProducts />} />
        <Route path="vendors/:vendorId/products" element={<DataEntryVendorProducts />} />
        <Route path="vendors/:vendorId/products/add" element={<DataEntryAddProduct />} />
        <Route path="vendors/:vendorId/products/:productId/edit" element={<DataEntryAddProduct />} />
        <Route path="kyc-review" element={<KycApprovals />} />
        <Route path="kyc" element={<KycApprovals />} />
      </Route>

      {/* Employees - Support */}
      <Route path="support" element={<EmployeeLayout allowedRole="SUPPORT" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SupportDashboard />} />
        <Route path="tickets" element={<SupportTickets />} />
      </Route>

      {/* Employees - Sales */}
      <Route path="sales" element={<EmployeeLayout allowedRole="SALES" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SalesDashboard />} />
        <Route path="leads" element={<SalesLeads />} />
        <Route path="pricing-rules" element={<PricingRules />} />
      </Route>

      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
};
