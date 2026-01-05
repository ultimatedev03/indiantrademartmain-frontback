import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import VendorPortalLayout from '@/modules/vendor/layouts/PortalLayout';
import VendorDashboard from '@/modules/vendor/pages/Dashboard';
import VendorProducts from '@/modules/vendor/pages/Products';
import VendorProductForm from '@/modules/vendor/pages/ProductForm';
import Leads from '@/modules/vendor/pages/Leads';
import LeadDetail from '@/modules/vendor/pages/LeadDetail'; // ✅ ADD
import Proposals from '@/modules/vendor/pages/Proposals';
import SendQuotation from '@/modules/vendor/pages/SendQuotation';
import VendorProfile from '@/modules/vendor/pages/Profile';
import VendorSettings from '@/modules/vendor/pages/Settings';
import VendorServices from '@/modules/vendor/pages/Services';
import VendorSupport from '@/modules/vendor/pages/Support';
import PhotosDocs from '@/modules/vendor/pages/PhotosDocs';
import VendorRegister from '@/modules/vendor/pages/auth/Register';
import VendorLogin from '@/modules/vendor/pages/auth/Login';
import VendorVerify from '@/modules/vendor/pages/auth/Verify';
import ForgotPassword from '@/shared/pages/ForgotPassword';
import VendorAnalytics from '@/modules/vendor/pages/Analytics';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import PageStatusWrapper from '@/components/PageStatusWrapper';

export const VendorRoutes = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="login" element={<VendorLogin />} />
      <Route
        path="register"
        element={
          <PageStatusWrapper pageRoute="/vendor/register">
            <VendorRegister />
          </PageStatusWrapper>
        }
      />
      <Route path="verify" element={<VendorVerify />} />
      <Route path="forgot-password" element={<ForgotPassword />} />

      {/* Protected Portal Routes */}
      <Route element={<ProtectedRoute allowedRoles={['VENDOR']} redirectTo="/vendor/login" />}>
        <Route
          element={
            <PageStatusWrapper pageRoute="/vendor">
              <VendorPortalLayout />
            </PageStatusWrapper>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<VendorDashboard />} />
          <Route path=":vendorId/dashboard" element={<VendorDashboard />} />

          <Route path="products" element={<VendorProducts />} />
          <Route path="products/add" element={<VendorProductForm />} />
          <Route path="products/:id/edit" element={<VendorProductForm />} />

          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} /> {/* ✅ ADD THIS ROUTE */}

          <Route path="proposals" element={<Proposals />} />
          <Route path="proposals/send" element={<SendQuotation />} />

          <Route path="kyc" element={<Navigate to="/vendor/profile?tab=kyc" replace />} />

          <Route path="support" element={<VendorSupport />} />
          <Route path="profile" element={<VendorProfile />} />
          <Route path="settings" element={<VendorSettings />} />
          <Route path="photos-docs" element={<PhotosDocs />} />
          <Route path="analytics" element={<VendorAnalytics />} />
          <Route path="subscriptions" element={<VendorServices />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/vendor/login" replace />} />
    </Routes>
  );
};
