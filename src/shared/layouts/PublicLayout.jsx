
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';
import QuotePopup from '@/shared/components/QuotePopup';
import { Toaster } from '@/components/ui/toaster';
import { supabase } from '@/lib/customSupabaseClient';
import MaintenancePage from '@/shared/components/MaintenancePage';
import { Loader2 } from 'lucide-react';

const PublicLayout = () => {
  const location = useLocation();
  const [pageStatus, setPageStatus] = useState({ isBlocked: false, message: '' });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      // Normalize path (remove trailing slash unless it's just /)
      const path = location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '');
      
      try {
        const { data, error } = await supabase
          .from('page_status')
          .select('*')
          .eq('page_route', path)
          .maybeSingle();

        if (data && data.is_blanked) {
          setPageStatus({ isBlocked: true, message: data.error_message });
        } else {
          setPageStatus({ isBlocked: false, message: '' });
        }
      } catch (e) {
        console.error("Unexpected error in page status check:", e);
        setPageStatus({ isBlocked: false, message: '' });
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
    
    // Real-time updates for page availability
    const channel = supabase
      .channel('public:page_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'page_status' }, (payload) => {
        const path = location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '');
        if (payload.new.page_route === path) {
           setPageStatus({ 
             isBlocked: payload.new.is_blanked, 
             message: payload.new.error_message 
           });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location.pathname]);

  if (checking) {
    return (
       <div className="h-screen w-full flex items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
       </div>
    );
  }

  if (pageStatus.isBlocked) {
    return <MaintenancePage message={pageStatus.message} />;
  }

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
