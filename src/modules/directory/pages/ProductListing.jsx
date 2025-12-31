
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import Card from '@/shared/components/Card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import SearchBar from '@/shared/components/SearchBar';

const ProductListing = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'ACTIVE')
          .limit(20);
        setProducts(data || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">All Products</h1>
        <div className="flex flex-col md:flex-row gap-4">
           <SearchBar placeholder="Search products..." className="flex-1" />
           <div className="flex gap-2">
              <select className="border rounded-md px-3 py-2 bg-white"><option>Price: Low to High</option></select>
              <select className="border rounded-md px-3 py-2 bg-white"><option>Category</option></select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {mockProducts.map((product) => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
             <Card.Content className="p-0">
                <div className="h-48 bg-gray-100">
                   <img src={product.image} alt={product.name} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1595872018818-97555653a011" />
                </div>
                <div className="p-4">
                   <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                   <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                   <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-[#003D82]">{product.price}</span>
                      <div className="flex items-center text-xs text-yellow-600">
                         <Star className="w-3 h-3 mr-1 fill-yellow-600" /> {product.rating}
                      </div>
                   </div>
                   <Button size="sm" className="w-full bg-[#003D82] hover:bg-[#002d61]">View Details</Button>
                </div>
             </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProductListing;
