
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Star, ShoppingCart, Heart, Share2, Package, 
  Truck, Shield, BadgeCheck, MessageCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/shared/components/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data: productData } = await supabase
          .from('products')
          .select('*, vendor:vendors(*)')
          .eq('id', productId)
          .single();
        
        if (productData) {
          setProduct(productData);
          if (productData.vendor) {
            setVendor(productData.vendor);
          }
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  if (loading || !product) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  const handleAction = (action) => {
    toast({
      title: "Feature Coming Soon",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <>
      <Helmet>
        <title>{product.name} - {product.price} | IndianTradeMart</title>
        <meta name="description" content={`Buy ${product.name} from ${vendor.name}. Price: ${product.price}. Minimum order: ${product.minOrder}. Verified supplier with ${vendor.rating} star rating.`} />
      </Helmet>

      <div className="min-h-screen bg-neutral-50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Product Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="relative aspect-square rounded-lg overflow-hidden bg-white">
                <img 
                  className="w-full h-full object-cover"
                  alt={product.name}
                 src="https://images.unsplash.com/photo-1635865165118-917ed9e20936" />
                {product.featured && (
                  <div className="absolute top-4 left-4">
                    <Badge variant="warning" className="bg-yellow-500 text-white">
                      Featured
                    </Badge>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Product Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <Badge variant="primary" className="mb-3">
                  {product.category}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-[#003D82] mb-4">
                  {product.name}
                </h1>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i}
                          className={`h-5 w-5 ${i < Math.floor(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold">{product.rating}</span>
                  </div>
                  <span className="text-neutral-600">
                    ({product.reviews} reviews)
                  </span>
                </div>

                <div className="flex items-baseline gap-4 mb-6">
                  <span className="text-4xl font-bold text-[#00A699]">
                    {product.price}
                  </span>
                  <Badge variant="default">
                    Min Order: {product.minOrder}
                  </Badge>
                </div>

                {product.inStock && (
                  <Badge variant="success" className="mb-6">
                    ✓ In Stock
                  </Badge>
                )}
              </div>

              {/* Quantity Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-2 border border-neutral-300 rounded-lg text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  size="lg"
                  className="flex-1 bg-[#00A699] hover:bg-[#00857A] text-white"
                  onClick={() => handleAction('addToCart')}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#003D82] text-[#003D82] hover:bg-[#003D82] hover:text-white"
                  onClick={() => handleAction('requestQuote')}
                >
                  Request Quote
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleAction('favorite')}
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                >
                  <Heart className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleAction('share')}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t">
                <div className="text-center">
                  <Package className="h-8 w-8 mx-auto mb-2 text-[#00A699]" />
                  <p className="text-sm font-medium">Quality Product</p>
                </div>
                <div className="text-center">
                  <Truck className="h-8 w-8 mx-auto mb-2 text-[#00A699]" />
                  <p className="text-sm font-medium">Fast Delivery</p>
                </div>
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-[#00A699]" />
                  <p className="text-sm font-medium">Secure Payment</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Vendor Info */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                  <img 
                    className="w-full h-full object-cover"
                    alt={vendor.name}
                   src="https://images.unsplash.com/photo-1674309343862-394ff2960acf" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-[#003D82]">{vendor.name}</h3>
                    {vendor.verified && (
                      <BadgeCheck className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <p className="text-neutral-600 mb-3">{vendor.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {vendor.rating} ({vendor.reviews} reviews)
                    </span>
                    <span>{vendor.products} Products</span>
                    <span>{vendor.yearsInBusiness} years in business</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => navigate(`/vendor/${vendor.id}`)}
                    className="bg-[#003D82] hover:bg-[#00254E] text-white"
                  >
                    View Profile
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAction('contactVendor')}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contact
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Description */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 leading-relaxed mb-6">
                {product.name} is a high-quality product manufactured with precision and care. 
                This product meets all industry standards and is backed by our quality guarantee. 
                Perfect for {product.category.toLowerCase()} applications, it offers excellent 
                performance and durability.
              </p>
              <h4 className="font-semibold text-[#003D82] mb-3">Key Features:</h4>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>Premium quality materials</li>
                <li>Certified and tested</li>
                <li>Competitive pricing</li>
                <li>Quick delivery available</li>
                <li>Excellent after-sales support</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ProductDetail;
