import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { Input } from '@/components/ui/input';
import { Search, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Directory = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  const INITIAL_LIMIT = 10;

  useEffect(() => {
    const loadCats = async () => {
      try {
        const data = await directoryApi.getHeadCategories();
        setCategories(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadCats();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        const results = await directoryApi.searchMicroCategories(searchTerm);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const visibleCategories = useMemo(() => {
    if (showAll) return categories;
    return categories.slice(0, INITIAL_LIMIT);
  }, [categories, showAll]);

  const hasMore = categories.length > INITIAL_LIMIT;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Hero Search */}
      <div className="bg-[#003D82] py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Find Products & Suppliers</h1>
          <div className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center bg-white rounded-lg shadow-xl">
              <Search className="w-5 h-5 text-gray-400 ml-4" />
              <Input
                className="border-0 focus-visible:ring-0 h-14 text-lg"
                placeholder="Search for any product or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Typeahead Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-xl mt-2 z-50 overflow-hidden text-left border border-gray-100">
                {suggestions.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b last:border-0"
                    onClick={() => {
                      navigate(`/directory/${item.head_slug}/${item.sub_slug}/${item.slug}`);
                    }}
                  >
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.path}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Browse Industries</h2>

          {/* View more / less */}
          {hasMore && !loading && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-4"
            >
              {showAll ? 'View less' : 'View more'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {visibleCategories.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/directory/${cat.slug}`}
                    className="block bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-500 transition-all group h-full"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-2xl group-hover:bg-blue-600 transition-colors">
                        📦
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-700">{cat.name}</h3>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {cat.description || 'Explore products and suppliers in this category.'}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Bottom View more (optional, nice UX) */}
            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="px-6 py-3 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all font-semibold text-slate-800"
                >
                  {showAll ? 'View less' : `View more (${categories.length - INITIAL_LIMIT})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Directory;