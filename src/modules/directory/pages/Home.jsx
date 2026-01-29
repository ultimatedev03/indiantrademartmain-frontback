import React, { useMemo, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import HeroSection from '@/modules/directory/components/HeroSection';
import TopCitiesSection from '@/modules/directory/components/TopCitiesSection';
import PremiumBrandsSection from '@/modules/directory/components/PremiumBrandsSection';
import HeadCategoryShowcase from '@/modules/directory/components/HeadCategoryShowcase';
import { vendorService } from '@/modules/directory/services/vendorService';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { categoryApi } from '@/modules/directory/services/categoryApi';

const HOME_SEO = {
  title:
    'Indian Trade Mart- India’s leading online B2B marketplace and platform for Indian Manufacturers, Suppliers, Exporters, Service provider, Directory.',
  description:
    'indiantrademart.com is  single window & India’s leading online B2B marketplace and platform for Indian Manufacturers, Suppliers, Exporters & Service provider, serving as the pivotal link between buyers and suppliers, free online business directory & yellow page with listing Indian & International companies. We provide a platform to empowering generations of entrepreneurs, Small & Medium Enterprises, Large Enterprises as well as individual users. Find here quality products, trade leads, manufacturers, suppliers, exporters & international buyers.',
  keywords:
    'online B2B marketplace, online B2B platform, Business directory, business directory in India, business e-commerce, business listings, B2C online marketplaces in India, Digital commerce platform, business website, business marketplace, companies business listings, companies database india, companies directory, companies directory india, directory of companies, directory of indian companies, service provider, e-commerce in india, trade & commerce, exporter importer directory, exporters business directory, exporters in india, free business listings, free business listings in india, free business marketplace, free indian companies business listings, free manufacturers directory india, importers, india business directory, india export import, india importers, Indian Trade Mart, indian business, Indian companies directory, indian exporters, indian exporters directory, indian manufacturers directory, indian market, indian service providers, manufacturers directory, manufacturers in india, online business directory, suppliers directory, yellow pages, Properties, Builder & Real Estate, Survey & Soil Investigation, Engineering Services, Construction Materials & Machines, Construction Materials & Machines, Electrical Equipment, Electronics & Electrical, R & D and Testing Labs, Business & Audit Services, Product Rental & Leasing, Product Rental & Leasing, Hand & Machine Tools, Mechanical Parts & Spares, Industrial Supplies, Industrial Plants & Machinery, Food & Beverages, Apparel & Garments, Packaging Machines & Goods, Chemicals, Dyes & Solvents, Lab Instruments & Supplies, Furniture & Supplies, Automobile, Parts & Spares, Housewares & Supplies, Metals, Alloys & Minerals, Handicrafts & Decorative, Kitchen Utensils & Appliances, Textiles, Yarn & Fabrics, Books & Stationery, Cosmetics & Personal Care, Home Textile & Furnishing, Drugs & Pharmaceuticals, Gems, Jewelry & Astrology, Computer & IT Solutions, Fashion Accessories & Gear, Herbal & Ayurvedic Product, Security Systems & Services, Sports Goods, Toys & Games, Paper & Paper Products, Bags, Belts & Wallets, Media, PR & Publishing, Marble, Granite & Stones, Event Planner & Organizer, IT & Telecom Services, Transportation & Logistics, Financial & Legal Services, Education & Training, Travel, Tourism & Hotels, Call Center & BPO Services, Bicycle, Rickshaw & Spares, Hospital & Diagnostics, HR Planning & Recruitment, Rail, Shipping & Aviation, House Keeping Services, Leather Products, Misc Contractors & Freelancers, Electronics Components, Hospital, Clinic & Consultation, Construction & Infrastructural Consultant, Album, Movies, Commercial Ads',
};

const Home = () => {
  const navigate = useNavigate();

  // ✅ Home page pe exactly 8 suppliers dikhane hain
  const FEATURED_INITIAL_LIMIT = 8;
  // ✅ But DB se 8+ vendors fetch karne honge, because vendorService ka default limit 6 hai
  const FEATURED_FETCH_LIMIT = 50;

  // Small helper to avoid broken images in Featured Suppliers.
  const VendorImage = ({ src, name }) => {
    const [failed, setFailed] = useState(false);
    const letter = String(name || 'S').trim().charAt(0).toUpperCase() || 'S';

    if (!src || failed) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-5xl font-extrabold text-slate-300">
          {letter}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  };

  const [homeCategories, setHomeCategories] = useState([]);
  const [featuredVendors, setFeaturedVendors] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [showAllHeads, setShowAllHeads] = useState(false);
  const HEAD_INITIAL_LIMIT = 3;

  useEffect(() => {
    const load = async () => {
      setLoadingCategories(true);
      try {
        const data = await categoryApi.getHomeShowcaseCategories();
        setHomeCategories(data || []);
      } catch (e) {
        console.error('Failed to load home categories:', e);
      } finally {
        setLoadingCategories(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingVendors(true);
      try {
        // ✅ IMPORTANT FIX: vendorService default 6 -> so we pass bigger limit
        const vendors = await vendorService.getFeaturedVendors({ limit: FEATURED_FETCH_LIMIT });
        setFeaturedVendors(vendors || []);
      } catch (e) {
        console.error('Failed to load featured vendors:', e);
      } finally {
        setLoadingVendors(false);
      }
    };
    load();
  }, []);

  const visibleHeads = useMemo(() => {
    if (showAllHeads) return homeCategories;
    return homeCategories.slice(0, HEAD_INITIAL_LIMIT);
  }, [homeCategories, showAllHeads]);

  const hasMoreHeads = homeCategories.length > HEAD_INITIAL_LIMIT;

  // ✅ Home UI: only 8 show
  const visibleFeaturedVendors = useMemo(
    () => (featuredVendors || []).slice(0, FEATURED_INITIAL_LIMIT),
    [featuredVendors]
  );

  const extraFeaturedCount = Math.max(
    0,
    (featuredVendors?.length || 0) - FEATURED_INITIAL_LIMIT
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <Helmet>
        <title>{HOME_SEO.title}</title>
        <meta name="description" content={HOME_SEO.description} />
        <meta name="keywords" content={HOME_SEO.keywords} />
      </Helmet>

      <HeroSection />

      {/* ✅ IndiaMART-style Category Sections */}
      <section className="bg-white py-12 shadow-sm relative z-10 -mt-8 rounded-t-3xl border-t border-slate-100 mx-4 lg:mx-0">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-1">
                Browse by Category
              </h2>
            </div>

            {hasMoreHeads && (
              <button
                type="button"
                onClick={() => setShowAllHeads((v) => !v)}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
              >
                {showAllHeads ? 'View less' : 'View more'}
              </button>
            )}
          </div>

          {loadingCategories ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-8">
              {visibleHeads.map((head) => (
                <HeadCategoryShowcase
                  key={head.id}
                  head={head}
                  subcategories={head.subcategories || []}
                  subLimit={9}
                  microPreviewLimit={3}
                  leftOverlayLimit={5}
                />
              ))}

              {homeCategories.length === 0 && (
                <div className="text-center text-slate-500 py-10">
                  No categories found.
                </div>
              )}

              {hasMoreHeads && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllHeads((v) => !v)}
                    className="px-6 py-3 rounded-md bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all font-semibold text-slate-800"
                  >
                    {showAllHeads
                      ? 'View less'
                      : `View more (${homeCategories.length - HEAD_INITIAL_LIMIT})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Top Cities Section */}
      <TopCitiesSection />

      {/* Premium Brands Section */}
      <PremiumBrandsSection />

      {/* Featured Vendors */}
      <section className="py-20 bg-slate-50 container mx-auto px-4">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Featured Suppliers
            </h2>
            <p className="text-slate-500">Trusted partners for your business needs</p>
          </div>

          <Button
            variant="link"
            className="text-blue-600 font-semibold hover:text-blue-800 p-0 h-auto"
            onClick={() => navigate('/directory/vendor')}
          >
            View More Suppliers{extraFeaturedCount > 0 ? ` (${extraFeaturedCount})` : ''}{' '}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loadingVendors ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {visibleFeaturedVendors.map((vendor) => (
              <motion.div
                key={vendor.id}
                whileHover={{ y: -5 }}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => navigate(`/directory/vendor/${vendor.id}`)}
              >
                <div className="relative h-48 mb-4 rounded-lg bg-slate-100 overflow-hidden">
                  <VendorImage src={vendor.image} name={vendor.name} />
                  {vendor.verified && (
                    <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-bold text-blue-700 flex items-center gap-1.5 shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5 fill-blue-100" /> Verified
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-lg line-clamp-1 mb-1 group-hover:text-blue-700 transition-colors">
                  {vendor.name}
                </h3>

                <div className="flex items-center text-sm text-slate-500 mb-4">
                  <MapPin className="w-3.5 h-3.5 mr-1.5" /> {vendor.city}, {vendor.state}
                </div>

                <Button className="w-full bg-white border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-medium h-10">
                  Contact Supplier
                </Button>
              </motion.div>
            ))}

            {featuredVendors.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-10">
                No featured vendors found.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
