
import React, { useState, useEffect } from 'react';
import { vendorService } from '@/modules/directory/services/vendorService';
import Card from '@/shared/components/Card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, ShieldCheck } from 'lucide-react';
import SearchBar from '@/shared/components/SearchBar';

const VendorListing = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const data = await vendorService.getFeaturedVendors();
        setVendors(data || []);
      } catch (error) {
        console.error('Failed to fetch vendors:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, []);

  const featuredVendors = vendors;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">All Vendors</h1>
        <div className="flex flex-col md:flex-row gap-4">
           <SearchBar placeholder="Search vendors..." className="flex-1" />
           <div className="flex gap-2">
              <select className="border rounded-md px-3 py-2 bg-white"><option>All States</option></select>
              <select className="border rounded-md px-3 py-2 bg-white"><option>All Cities</option></select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {featuredVendors.map((vendor) => (
          <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
            <Card.Content className="p-0">
               <div className="h-40 bg-gray-100 relative">
                  <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1597250738215-0ebba267df2f" />
                  {vendor.verified && (
                    <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                    </span>
                  )}
               </div>
               <div className="p-5">
                  <h3 className="font-bold text-lg mb-1">{vendor.name}</h3>
                  <div className="flex items-center text-sm text-gray-500 mb-2">
                    <MapPin className="w-4 h-4 mr-1" /> {vendor.city || 'Mumbai'}, {vendor.state || 'Maharashtra'}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                     <div className="flex items-center bg-yellow-100 px-2 py-0.5 rounded text-xs font-bold text-yellow-800">
                        <Star className="w-3 h-3 mr-1 fill-yellow-800" /> {vendor.rating}
                     </div>
                     <span className="text-xs text-gray-500">({vendor.reviews} Reviews)</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                     {vendor.description || "Leading supplier of industrial goods and machinery."}
                  </p>
                  <Button variant="outline" className="w-full">View Profile</Button>
               </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VendorListing;
