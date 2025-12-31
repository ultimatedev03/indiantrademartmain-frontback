
import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

const CareerLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center space-x-2">
               <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-lg w-8 h-8 flex items-center justify-center">
                 C
               </div>
               <span className="font-bold text-xl text-slate-900 hidden sm:inline-block">
                 ITM <span className="text-rose-500">Careers</span>
               </span>
            </Link>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/jobs" className="transition-colors hover:text-rose-500 text-slate-600">Open Roles</Link>
            <Link to="/culture" className="transition-colors hover:text-rose-500 text-slate-600">Life at ITM</Link>
            <Link to="/internships" className="transition-colors hover:text-rose-500 text-slate-600">Internships</Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default CareerLayout;
