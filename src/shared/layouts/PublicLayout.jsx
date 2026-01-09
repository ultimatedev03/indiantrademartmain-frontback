import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';
import QuotePopup from '@/shared/components/QuotePopup';
import { Toaster } from '@/components/ui/toaster';

const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-grow pt-16">
        <Outlet />
      </main>

      <Footer />

      <QuotePopup />
      <Toaster />
    </div>
  );
};

export default PublicLayout;
