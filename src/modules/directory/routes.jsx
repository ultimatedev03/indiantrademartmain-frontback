import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '@/shared/layouts/PublicLayout';

import Directory from '@/modules/directory/pages/Directory';
import CitiesPage from '@/modules/directory/pages/CitiesPage';
import CityPage from '@/modules/directory/pages/CityPage';
import SubCategoryPage from '@/modules/directory/pages/SubCategoryPage';
import MicroCategoryPage from '@/modules/directory/pages/MicroCategoryPage';
import DynamicCategory from '@/modules/directory/pages/DynamicCategory';
import ProductListing from '@/modules/directory/pages/ProductListing';
import ProductDetail from '@/modules/directory/pages/ProductDetail';
import SearchResults from '@/modules/directory/pages/SearchResults';

import Home from '@/modules/directory/pages/Home';
import AboutUs from '@/modules/directory/pages/AboutUs';
import BecomeVendor from '@/modules/directory/pages/BecomeVendor';
import Pricing from '@/modules/directory/pages/Pricing';
import Login from '@/modules/directory/pages/Login';
import Logistics from '@/modules/directory/pages/Logistics';

import VendorListing from '@/modules/directory/pages/VendorListing';
import VendorProfilePublic from '@/modules/directory/pages/VendorProfile';

import Press from '@/modules/directory/pages/Press';
import Investor from '@/modules/directory/pages/Investor';
import ForgotPassword from '@/shared/pages/ForgotPassword';

import {
  JoinSales,
  SuccessStories,
  Help,
  CustomerCare,
  Complaints,
  Jobs,
  ContactPage,
  BuyLeads,
  LearningCentre,
  ProductsPage
} from '@/modules/directory/pages/FooterPages';

export const DirectoryRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>

        {/* Home */}
        <Route index element={<Home />} />

        {/* Directory Base */}
        <Route path="directory" element={<Directory />} />

        {/* Cities */}
        <Route path="directory/cities" element={<CitiesPage />} />
        <Route path="directory/city/:citySlug" element={<CityPage />} />
        {/* Alias: /city/:citySlug */}
        <Route path="city/:citySlug" element={<CityPage />} />

        {/* Vendor */}
        <Route path="directory/vendor" element={<VendorListing />} />
        <Route path="directory/vendor/:vendorId" element={<VendorProfilePublic />} />

        {/* Search (MOST specific first) */}
        <Route path="directory/search/:service/:state/:city" element={<SearchResults />} />
        <Route path="directory/search/:service/:state" element={<SearchResults />} />
        <Route path="directory/search/:service" element={<SearchResults />} />
        <Route path="directory/search" element={<Navigate to="/directory" replace />} />
        {/* Alias: /search-suppliers -> /directory/vendor */}
        <Route path="search-suppliers" element={<Navigate to="/directory/vendor" replace />} />

        {/* Category Hierarchy */}
        {/* ✅ Product listing supports optional state/city slugs for auto-filter */}
        <Route path="directory/:headSlug/:subSlug/:microSlug/:stateSlug/:citySlug" element={<ProductListing />} />
        <Route path="directory/:headSlug/:subSlug/:microSlug/:stateSlug" element={<ProductListing />} />
        <Route path="directory/:headSlug/:subSlug/:microSlug" element={<ProductListing />} />

        <Route path="directory/:headSlug/:subSlug" element={<MicroCategoryPage />} />
        <Route path="directory/:headSlug" element={<SubCategoryPage />} />

        {/* Dynamic catch-all (LAST) */}
        <Route path="directory/:fullSlug" element={<DynamicCategory />} />

        {/* Product Detail */}
        <Route path="p/:productSlug" element={<ProductDetail />} />

        {/* Auth */}
        <Route path="auth/login" element={<Login />} />
        <Route path="auth/forgot-password" element={<ForgotPassword />} />

        {/* Static Pages */}
        <Route path="about-us" element={<AboutUs />} />
        <Route path="become-a-vendor" element={<BecomeVendor />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="logistics" element={<Logistics />} />

        {/* Footer Info */}
        <Route path="press" element={<Press />} />
        <Route path="investor" element={<Investor />} />
        <Route path="join-sales" element={<JoinSales />} />
        <Route path="success-stories" element={<SuccessStories />} />

        {/* Support */}
        <Route path="help" element={<Help />} />
        <Route path="customer-care" element={<CustomerCare />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="contact" element={<ContactPage />} />

        {/* Toolkits */}
        <Route path="buyleads" element={<BuyLeads />} />
        <Route path="learning-centre" element={<LearningCentre />} />
        <Route path="products" element={<ProductsPage />} />

        {/* Alias */}
        <Route path="search" element={<Navigate to="/directory" replace />} />

      </Route>
    </Routes>
  );
};
