import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Home, MapPin, Filter, Star, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ProductsListing = () => {
  const { headSlug, subSlug, microSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState([]);

  // Filters
  const stateId = searchParams.get('state') || '';
  const q = searchParams.get('q') || '';

  // ✅ FIX: Radix Select doesn't allow empty string values in <SelectItem />
  const sortParam = searchParams.get('sort') || '';
  const sortValue = sortParam || 'relevance'; // value passed to Select must be non-empty

  useEffect(() => {
    const loadMeta = async () => {
      const s = await directoryApi.getStates();
      setStates(s);
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        // If no microSlug but has search query, do generic search
        if (!microSlug && q) {
          const { data } = await directoryApi.searchProducts({ q, stateId, sort: sortParam, page: 1 });
          setProducts(data || []);
        } else if (microSlug) {
          const { data } = await directoryApi.listProductsByMicro({
            microSlug,
            stateId,
            q,
            sort: sortParam,
            page: 1
          });
          setProducts(data);
        } else {
          setProducts([]);
        }
      } catch (e) {
        console.error(e);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [microSlug, stateId, q, sortParam]);

  const updateFilter = (key, val) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set(key, val);
    else newParams.delete(key);
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header / Breadcrumb */}
      <div className="bg-white border-b py-4">
        <div className="container mx-auto px-4">
          {microSlug ? (
            <>
              <nav className="flex text-sm text-gray-500 mb-2 items-center flex-wrap">
                <Link to="/directory" className="hover:text-blue-700 flex items-center">
                  <Home className="w-3 h-3 mr-1" /> Directory
                </Link>
                <ChevronRight className="w-4 h-4 mx-2" />
                <Link to={`/directory/${headSlug}`} className="hover:text-blue-700 capitalize">
                  {headSlug?.replace(/-/g, ' ')}
                </Link>
                <ChevronRight className="w-4 h-4 mx-2" />
                <Link to={`/directory/${headSlug}/${subSlug}`} className="hover:text-blue-700 capitalize">
                  {subSlug?.replace(/-/g, ' ')}
                </Link>
                <ChevronRight className="w-4 h-4 mx-2" />
                <span className="font-semibold text-gray-900 capitalize">
                  {microSlug?.replace(/-/g, ' ')}
                </span>
              </nav>
              <h1 className="text-2xl font-bold text-slate-900 capitalize">
                {microSlug?.replace(/-/g, ' ')} Suppliers & Products
              </h1>
            </>
          ) : (
            <>
              <nav className="flex text-sm text-gray-500 mb-2 items-center flex-wrap">
                <Link to="/directory" className="hover:text-blue-700 flex items-center">
                  <Home className="w-3 h-3 mr-1" /> Directory
                </Link>
              </nav>
              <h1 className="text-2xl font-bold text-slate-900">
                Search Results {q && `for "${q}"`}
              </h1>
            </>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 space-y-6">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
              <Filter className="w-4 h-4" /> Filters
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Search</label>
                <Input
                  placeholder="Search within category..."
                  value={q}
                  onChange={(e) => updateFilter('q', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Location (State)</label>
                <Select value={stateId} onValueChange={(v) => updateFilter('state', v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All India" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All India</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Sort By</label>
                <Select
                  value={sortValue}
                  onValueChange={(v) => updateFilter('sort', v === 'relevance' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Relevance" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* ✅ FIX: No empty string values */}
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </aside>

        {/* Results Grid */}
        <main className="flex-1">
          {loading ? (
            <div className="text-center py-20">
              <Loader2 className="animate-spin mx-auto w-8 h-8 text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {products.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-lg border border-dashed">
                  <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                  <p className="text-gray-500">Try adjusting your filters.</p>
                </div>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6"
                  >
                    {/* Image */}
                    <div className="w-full md:w-48 h-48 bg-slate-100 rounded-md flex-shrink-0 overflow-hidden border">
                      <img
                        src={product.images?.[0] || 'https://via.placeholder.com/300'}
                        className="w-full h-full object-cover"
                        alt={product.name}
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <Link
                        to={`/p/${product.slug}`}
                        className="text-xl font-bold text-[#003D82] hover:underline mb-1 block"
                      >
                        {product.name}
                      </Link>
                      <div className="text-2xl font-bold text-slate-900 mb-2">
                        ₹{product.price}{' '}
                        <span className="text-sm font-normal text-slate-500">/ {product.price_unit}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {product.min_order_qty && (
                          <Badge variant="secondary">Min Order: {product.min_order_qty}</Badge>
                        )}
                        <Badge variant="outline">In Stock</Badge>
                      </div>

                      {/* Vendor Info */}
                      {product.vendors && (
                        <div className="border-t pt-3 mt-auto">
                          <div className="font-semibold text-slate-800">{product.vendors.company_name}</div>
                          <div className="flex items-center text-sm text-slate-500 mt-1 gap-4">
                            <span className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1" /> {product.vendors.city},{' '}
                              {product.vendors.state}
                            </span>
                            {product.vendors.verification_badge && (
                              <span className="text-green-600 flex items-center font-medium">
                                <Badge className="bg-green-100 text-green-800 h-5 px-1 mr-1">✔</Badge> Verified
                              </span>
                            )}
                            {product.vendors.seller_rating && (
                              <span className="flex items-center text-amber-500 font-bold">
                                <Star className="w-3 h-3 fill-current mr-1" /> {product.vendors.seller_rating}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex gap-3">
                        <Button className="bg-[#003D82]" onClick={() => navigate(`/p/${product.slug}`)}>
                          View Details
                        </Button>
                        <Button variant="outline">Contact Supplier</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProductsListing;