import React from "react";
import { Routes, Route, Navigate, Outlet, useLocation, Link } from "react-router-dom";

import BuyerLayout from "@/modules/buyer/layouts/BuyerLayout";
import BuyerDashboard from "@/modules/buyer/pages/Dashboard";
import Proposals from "@/modules/buyer/pages/Proposals";
import CreateProposal from "@/modules/buyer/pages/CreateProposal";
import BuyerProfile from "@/modules/buyer/pages/Profile";
import BuyerMessages from "@/modules/buyer/pages/Messages";
import BuyerTickets from "@/modules/buyer/pages/Tickets";
import BuyerFavorites from "@/modules/buyer/pages/Favorites";
import BuyerSuggestions from "@/modules/buyer/pages/Suggestions";
import BuyerRegister from "@/modules/buyer/pages/auth/Register";
import BuyerLogin from "@/modules/buyer/pages/auth/Login";
import ForgotPassword from "@/shared/pages/ForgotPassword";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import { BuyerAuthProvider, useBuyerAuth } from "@/modules/buyer/context/AuthContext";
import PageStatusWrapper from "@/components/PageStatusWrapper";
import ProposalDetail from "@/modules/buyer/pages/ProposalDetail";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ✅ Inline Suspended Page
const AccountSuspendedPage = () => {
  const { logout } = useBuyerAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold text-red-600">Account Suspended</h1>
        <p className="text-gray-600">
          Your buyer account has been suspended by Admin. You can still access Support Tickets.
          Please contact support to re-activate your account.
        </p>

        <div className="flex gap-3 flex-wrap">
          <Button asChild>
            <Link to="/buyer/tickets">Open Support Tickets</Link>
          </Button>

          {/* ✅ FIX: force redirect after logout so it always works */}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await logout();
              } finally {
                // Force redirect (handles cases where navigate isn't triggered due to guard/layout)
                window.location.href = "/buyer/login";
              }
            }}
          >
            Logout
          </Button>
        </div>

        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
          Support Email:{" "}
          <span className="font-mono text-blue-600">support@indiantrademart.com</span>
        </div>
      </div>
    </div>
  );
};

/**
 * ✅ Buyer Suspension Guard
 * Suspended => allow only /buyer/tickets and /buyer/account-suspended
 * Active again => if user is on /buyer/account-suspended, redirect to /buyer/dashboard
 */
const BuyerSuspensionGuard = () => {
  const { buyerLoading, isBuyerSuspended, isAuthenticated } = useBuyerAuth();
  const location = useLocation();
  const path = location.pathname;

  if (buyerLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/buyer/login" replace state={{ from: path }} />;
  }

  // ✅ MAIN FIX: Active ho gaya but still on suspended page -> dashboard
  if (!isBuyerSuspended && path === "/buyer/account-suspended") {
    return <Navigate to="/buyer/dashboard" replace />;
  }

  const allowedWhenSuspended =
    path === "/buyer/tickets" ||
    path.startsWith("/buyer/tickets/") ||
    path === "/buyer/account-suspended";

  // ✅ Suspended and trying other pages -> force suspended page
  if (isBuyerSuspended && !allowedWhenSuspended) {
    return <Navigate to="/buyer/account-suspended" replace />;
  }

  return <Outlet />;
};

export const BuyerRoutes = () => {
  return (
    <BuyerAuthProvider>
      <Routes>
        <Route path="login" element={<BuyerLogin />} />

        <Route
          path="register"
          element={
            <PageStatusWrapper pageRoute="/buyer/register">
              <BuyerRegister />
            </PageStatusWrapper>
          }
        />

        <Route path="forgot-password" element={<ForgotPassword />} />

        <Route element={<ProtectedRoute allowedRoles={["BUYER"]} />}>
          <Route element={<BuyerSuspensionGuard />}>
            <Route
              element={
                <PageStatusWrapper pageRoute="/buyer">
                  <BuyerLayout />
                </PageStatusWrapper>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />

              <Route path="dashboard" element={<BuyerDashboard />} />
              <Route path="proposals" element={<Proposals />} />
              <Route path="proposals/new" element={<CreateProposal />} />
              <Route path="proposals/:id" element={<ProposalDetail />} />
              <Route path="profile" element={<BuyerProfile />} />
              <Route path="messages" element={<BuyerMessages />} />

              {/* ✅ always allowed */}
              <Route path="tickets" element={<BuyerTickets />} />

              <Route path="favorites" element={<BuyerFavorites />} />
              <Route path="suggestions" element={<BuyerSuggestions />} />

              {/* ✅ suspended */}
              <Route path="account-suspended" element={<AccountSuspendedPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/buyer/login" replace />} />
      </Routes>
    </BuyerAuthProvider>
  );
};