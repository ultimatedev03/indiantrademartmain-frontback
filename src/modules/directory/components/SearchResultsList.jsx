
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin, ShoppingCart, BadgeCheck, PackageX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/shared/components/Badge';
import { toast } from '@/components/ui/use-toast';

const SearchResultsList = ({ products, query, city, category }) => {
  const navigate = useNavigate();

  const displayProducts = products || [];
  const isUsingMock = false;

  const handleAddToCart = (e, product) => {
    e.stopPropagation();
    toast({
      title: "Feature Coming Soon",
      description: "🚧 This feature isn't implemented yet.",
    });
  };

  if (!isUsingMock && products.length === 0) {
      return (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
              <PackageX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No products found</h3>
              <p className="text-gray-500">Try adjusting your filters or search for a different category.</p>
          </div>
      );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-neutral-600">
          Showing <span className="font-semibold">{displayProducts.length}</span> results
          {isUsingMock && <span className="text-xs ml-2 text-amber-600">(Demo Data)</span>}
        </p>
        <select className="px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003D82]">
          <option>Relevance</option>
          <option>Price: Low to High</option>
          <option>Price: High to Low</option>
          <option>Rating</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displayProducts.map((product, index) => (
          <motion.div
            key={product.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all border border-neutral-200 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => navigate(`/product/${product.id}`)}
          >
            <div className="relative h-48 overflow-hidden bg-gray-100">
              <img 
                className="w-full h-full object-cover"
                alt={product.name}
                src={product.images?.[0] || product.image || "https://images.unsplash.com/photo-1635865165118-917ed9e20936"} 
                onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?auto=format&fit=crop&q=80&w=300" }}
              />
              {product.featured && (
                <div className="absolute top-3 left-3">
                  <Badge variant="warning" className="bg-yellow-500 text-white">
                    Featured
                  </Badge>
                </div>
              )}
            </div>

            <div className="p-5 flex-1 flex flex-col">
              <h3 className="font-bold text-lg text-[#003D82] mb-2 line-clamp-2">
                {product.name}
              </h3>
              
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-sm">{product.rating || product.vendorRating || 4.5}</span>
                </div>
                <span className="text-sm text-neutral-500">
                  ({product.reviews || 0} reviews)
                </span>
              </div>

              <div className="space-y-2 mb-4 mt-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-[#00A699]">
                    {typeof product.price === 'number' ? `₹${product.price.toLocaleString()}` : product.price}
                  </span>
                  {product.minOrder && (
                    <Badge variant="default" className="text-xs">
                        MOQ: {product.minOrder}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <BadgeCheck className={`h-4 w-4 ${product.vendorVerified ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-medium truncate">{product.vendorName || product.vendor}</span>
                </div>
                
                {(product.vendorCity || product.city) && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <MapPin className="h-3 w-3" />
                        <span>{product.vendorCity || product.city}, {product.vendorState || product.state}</span>
                    </div>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                <Button
                  className="flex-1 bg-[#003D82] hover:bg-[#00254E] text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/product/${product.id}`);
                  }}
                >
                  View Details
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-[#00A699] text-[#00A699] hover:bg-[#00A699] hover:text-white"
                  onClick={(e) => handleAddToCart(e, product)}
                >
                  <ShoppingCart className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SearchResultsList;
