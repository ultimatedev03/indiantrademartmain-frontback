import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '@/shared/layouts/PublicLayout';
import SubCategoryPage from '@/modules/directory/pages/SubCategoryPage';
import MicroCategoryPage from '@/modules/directory/pages/MicroCategoryPage';
import Directory from '@/modules/directory/pages/Directory';
import ProductListing from '@/modules/directory/pages/ProductListing';
import ProductDetail from '@/modules/directory/pages/ProductDetail';

import Home from '@/modules/directory/pages/Home';
import AboutUs from '@/modules/directory/pages/AboutUs';
import BecomeVendor from '@/modules/directory/pages/BecomeVendor';
import Pricing from '@/modules/directory/pages/Pricing';
import Login from '@/modules/directory/pages/Login';
import VendorListing from '@/modules/directory/pages/VendorListing';
import VendorProfilePublic from '@/modules/directory/pages/VendorProfile';
import Press from '@/modules/directory/pages/Press';
import Investor from '@/modules/directory/pages/Investor';
import ForgotPassword from '@/shared/pages/ForgotPassword';
import { JoinSales, SuccessStories, Help, CustomerCare, Complaints, Jobs, ContactPage, BuyLeads, LearningCentre, ProductsPage } from '@/modules/directory/pages/FooterPages';

export const DirectoryRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        
        {/* Directory Structure */}
        <Route path="directory" element={<Directory />} />
        <Route path="directory/:headSlug" element={<SubCategoryPage />} />
        <Route path="directory/:headSlug/:subSlug" element={<MicroCategoryPage />} />
        <Route path="directory/:headSlug/:subSlug/:microSlug" element={<ProductListing />} />
        
        {/* Search Alias */}
        <Route path="directory/search" element={<ProductListing />} />
        <Route path="search" element={<Navigate to="/directory" replace />} />

        {/* Product Detail */}
        <Route path="p/:productSlug" element={<ProductDetail />} />

        {/* Other Pages */}
        <Route path="about-us" element={<AboutUs />} />
        <Route path="become-a-vendor" element={<BecomeVendor />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="auth/login" element={<Login />} />
        <Route path="auth/forgot-password" element={<ForgotPassword />} />
        
        {/* Footer Information Links */}
        <Route path="press" element={<Press />} />
        <Route path="investor" element={<Investor />} />
        <Route path="join-sales" element={<JoinSales />} />
        <Route path="success-stories" element={<SuccessStories />} />
        
        {/* Footer Support Links */}
        <Route path="help" element={<Help />} />
        <Route path="customer-care" element={<CustomerCare />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="contact" element={<ContactPage />} />
        
        {/* Footer Suppliers Tool Kit */}
        <Route path="buyleads" element={<BuyLeads />} />
        <Route path="learning-centre" element={<LearningCentre />} />
        
        {/* Footer Buyers Tool Kit */}
        <Route path="products" element={<ProductsPage />} />
        
        <Route path="directory/vendor" element={<VendorListing />} />
        <Route path="directory/vendor/:vendorId" element={<VendorProfilePublic />} />
      </Route>
    </Routes>
  );
};