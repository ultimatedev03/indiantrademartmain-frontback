
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BuyerLayout from '@/modules/buyer/layouts/BuyerLayout';
import BuyerDashboard from '@/modules/buyer/pages/Dashboard';
import Proposals from '@/modules/buyer/pages/Proposals';
import CreateProposal from '@/modules/buyer/pages/CreateProposal';
import BuyerProfile from '@/modules/buyer/pages/Profile';
import BuyerMessages from '@/modules/buyer/pages/Messages';
import BuyerTickets from '@/modules/buyer/pages/Tickets';
import BuyerFavorites from '@/modules/buyer/pages/Favorites';
import BuyerSuggestions from '@/modules/buyer/pages/Suggestions';
import BuyerRegister from '@/modules/buyer/pages/auth/Register';
import BuyerLogin from '@/modules/buyer/pages/auth/Login';
import ForgotPassword from '@/shared/pages/ForgotPassword';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import { BuyerAuthProvider } from '@/modules/buyer/context/AuthContext';
import PageStatusWrapper from '@/components/PageStatusWrapper';

export const BuyerRoutes = () => {
  return (
    <BuyerAuthProvider>
      <Routes>
        <Route path="login" element={<BuyerLogin />} />
        <Route path="register" element={<PageStatusWrapper pageRoute="/buyer/register"><BuyerRegister /></PageStatusWrapper>} />
        <Route path="forgot-password" element={<ForgotPassword />} />

        <Route element={<ProtectedRoute allowedRoles={['BUYER']} />}>
          <Route element={<PageStatusWrapper pageRoute="/buyer"><BuyerLayout /></PageStatusWrapper>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<BuyerDashboard />} />
            <Route path="proposals" element={<Proposals />} />
            <Route path="proposals/new" element={<CreateProposal />} />
            <Route path="profile" element={<BuyerProfile />} />
            <Route path="messages" element={<BuyerMessages />} />
            <Route path="tickets" element={<BuyerTickets />} />
            <Route path="favorites" element={<BuyerFavorites />} />
            <Route path="suggestions" element={<BuyerSuggestions />} />
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="login" />} />
      </Routes>
    </BuyerAuthProvider>
  );
};
