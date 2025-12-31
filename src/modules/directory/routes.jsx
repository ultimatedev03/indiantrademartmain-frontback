import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicLayout from '@/shared/layouts/PublicLayout';
import DirectoryHome from '@/modules/directory/pages/DirectoryHome';
import SubCategoryPage from '@/modules/directory/pages/SubCategoryPage';
import MicroCategoryPage from '@/modules/directory/pages/MicroCategoryPage';
import ProductsListingPage from '@/modules/directory/pages/ProductsListingPage';
import ProductDetailPage from '@/modules/directory/pages/ProductDetailPage';

import Home from '@/modules/directory/pages/Home';
import AboutUs from '@/modules/directory/pages/AboutUs';
import BecomeVendor from '@/modules/directory/pages/BecomeVendor';
import Pricing from '@/modules/directory/pages/Pricing';
import Login from '@/modules/directory/pages/Login';
import VendorListing from '@/modules/directory/pages/VendorListing';
import VendorProfilePublic from '@/modules/directory/pages/VendorProfile';

export const DirectoryRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        
        {/* Directory Structure */}
        <Route path="directory" element={<DirectoryHome />} />
        <Route path="directory/:headSlug" element={<SubCategoryPage />} />
        <Route path="directory/:headSlug/:subSlug" element={<MicroCategoryPage />} />
        <Route path="directory/:headSlug/:subSlug/:microSlug" element={<ProductsListingPage />} />
        
        {/* Search Alias */}
        <Route path="directory/search" element={<ProductsListingPage />} />

        {/* Product Detail */}
        <Route path="p/:productSlug" element={<ProductDetailPage />} />

        {/* Other Pages */}
        <Route path="about-us" element={<AboutUs />} />
        <Route path="become-a-vendor" element={<BecomeVendor />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="auth/login" element={<Login />} />
        
        <Route path="directory/vendor" element={<VendorListing />} />
        <Route path="directory/vendor/:vendorId" element={<VendorProfilePublic />} />
      </Route>
    </Routes>
  );
};