import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import HeroSection from '@/modules/directory/components/HeroSection';
import TopCitiesSection from '@/modules/directory/components/TopCitiesSection';
import PremiumBrandsSection from '@/modules/directory/components/PremiumBrandsSection';
import { vendorService } from '@/modules/directory/services/vendorService';
import { Button } from '@/components/ui/button';
import { CheckCircle, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { categoryApi } from '@/modules/directory/services/categoryApi';

const Home = () => {
  const navigate = useNavigate();
  const [topLevelCategories, setTopLevelCategories] = useState([]);
  const [featuredVendors, setFeaturedVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ show only first 8 categories initially
  const [showAllCategories, setShowAllCategories] = useState(false);
  const INITIAL_LIMIT = 8;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [categories, vendors] = await Promise.all([
          categoryApi.getTopLevelCategories(),
          vendorService.getFeaturedVendors()
        ]);
        if (categories && categories.length > 0) {
            setTopLevelCategories(categories);
        }
        if (vendors) {
            setFeaturedVendors(vendors);
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const visibleCategories = useMemo(() => {
    if (showAllCategories) return topLevelCategories;
    return topLevelCategories.slice(0, INITIAL_LIMIT);
  }, [topLevelCategories, showAllCategories]);

  const hasMoreCategories = topLevelCategories.length > INITIAL_LIMIT;

  const getIconForCategory = (name) => {
      if (name.includes("Construction")) return "🏗️";
      if (name.includes("Electronic")) return "💻";
      if (name.includes("Industrial")) return "⚙️";
      if (name.includes("Apparel")) return "👕";
      if (name.includes("Agriculture") || name.includes("Food")) return "🌾";
      if (name.includes("Chemical")) return "🧪";
      return "📦";
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <HeroSection />

      {/* Dynamic Category Hierarchy */}
      <section className="bg-white py-16 shadow-sm relative z-10 -mt-8 rounded-t-3xl border-t border-slate-100 mx-4 lg:mx-0">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">Browse by Industry</h2>
                <p className="text-slate-500 max-w-2xl mx-auto">Comprehensive product listings from top manufacturers and verified suppliers across key sectors.</p>
            </div>
            
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <>
                    {/* ✅ Top view more/less */}
                    {hasMoreCategories && (
                      <div className="flex justify-end mb-4">
                        <button
                          type="button"
                          onClick={() => setShowAllCategories(v => !v)}
                          className="text-sm font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-4"
                        >
                          {showAllCategories ? 'View less' : 'View more'}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {visibleCategories.map((cat) => (
                            <motion.div 
                                key={cat.id}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
                                onClick={() => navigate(`/categories/${cat.slug}`)}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl bg-slate-50 w-14 h-14 flex items-center justify-center rounded-lg group-hover:bg-blue-50 transition-colors">
                                            {getIconForCategory(cat.name)}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-700 transition-colors">{cat.name}</h3>
                                            <p className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded-full mt-1">High Demand</p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                    </div>
                                </div>
                                <div className="pl-[4.5rem]">
                                    <p className="text-sm text-slate-500 mb-2">Industrial machinery, raw materials, tools...</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* ✅ Bottom view more/less */}
                    {hasMoreCategories && (
                      <div className="flex justify-center mt-10">
                        <button
                          type="button"
                          onClick={() => setShowAllCategories(v => !v)}
                          className="px-6 py-3 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all font-semibold text-slate-800"
                        >
                          {showAllCategories
                            ? 'View less'
                            : `View more (${topLevelCategories.length - INITIAL_LIMIT})`}
                        </button>
                      </div>
                    )}
                </>
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
               <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Suppliers</h2>
               <p className="text-slate-500">Trusted partners for your business needs</p>
            </div>
            <Button variant="link" className="text-blue-600 font-semibold hover:text-blue-800 p-0 h-auto">View All Suppliers <ChevronRight className="w-4 h-4 ml-1" /></Button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {featuredVendors.map((vendor) => (
              <motion.div 
                key={vendor.id}
                whileHover={{ y: -5 }}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => navigate(`/directory/vendor/${vendor.id}`)}
              >
                 <div className="relative h-48 mb-4 rounded-lg bg-slate-100 overflow-hidden">
                    <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {vendor.verified && (
                      <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-bold text-blue-700 flex items-center gap-1.5 shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5 fill-blue-100" /> Verified
                      </span>
                    )}
                 </div>
                 <h3 className="font-bold text-slate-900 text-lg line-clamp-1 mb-1 group-hover:text-blue-700 transition-colors">{vendor.name}</h3>
                 <div className="flex items-center text-sm text-slate-500 mb-4">
                    <MapPin className="w-3.5 h-3.5 mr-1.5" /> {vendor.city}, {vendor.state}
                 </div>
                 <Button className="w-full bg-white border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-medium h-10">
                   Contact Supplier
                 </Button>
              </motion.div>
            ))}
         </div>
      </section>
    </div>
  );
};

export default Home;