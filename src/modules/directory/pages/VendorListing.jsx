import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorService } from '@/modules/directory/services/vendorService';
import Card from '@/shared/components/Card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, ShieldCheck } from 'lucide-react';
import SearchBar from '@/shared/components/SearchBar';

const VendorListing = () => {
  const navigate = useNavigate();
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

  const VendorImage = ({ src, name }) => {
    const [failed, setFailed] = useState(false);
    const letter = String(name || 'S').trim().charAt(0).toUpperCase() || 'S';

    if (!src || failed) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-5xl font-extrabold text-gray-300">
          {letter}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">All Vendors</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <SearchBar placeholder="Search vendors..." className="flex-1" />
          <div className="flex gap-2">
            <select className="border rounded-md px-3 py-2 bg-white">
              <option>All States</option>
            </select>
            <select className="border rounded-md px-3 py-2 bg-white">
              <option>All Cities</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center text-gray-500 py-10">Loading vendors...</div>
        ) : (
          featuredVendors.map((vendor) => (
            <Card
              key={vendor.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/directory/vendor/${vendor.id}`)}
            >
              <Card.Content className="p-0">
                <div className="h-40 bg-gray-100 relative overflow-hidden">
                  <VendorImage src={vendor.image} name={vendor.name} />
                  {vendor.verified && (
                    <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-lg mb-1">{vendor.name}</h3>
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> {vendor.city || '-'}
                    {vendor.state ? `, ${vendor.state}` : ''}
                  </div>

                  {vendor.rating !== null && vendor.rating !== undefined && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center bg-yellow-100 px-2 py-0.5 rounded text-xs font-bold text-yellow-800">
                        <Star className="w-3 h-3 mr-1 fill-yellow-800" /> {Number(vendor.rating).toFixed(1)}
                      </div>
                    </div>
                  )}

                  {vendor.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{vendor.description}</p>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/directory/vendor/${vendor.id}`);
                    }}
                  >
                    View Profile
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))
        )}

        {!loading && featuredVendors.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-10">No vendors found.</div>
        )}
      </div>
    </div>
  );
};

export default VendorListing;
