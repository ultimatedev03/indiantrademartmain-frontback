
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { directoryApi } from '@/modules/directory/services/directoryApi';
import { motion } from 'framer-motion';

const TopCitiesSection = () => {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);

  useEffect(() => {
    const loadCities = async () => {
      const data = await directoryApi.getTopCities(10);
      setCities(data || []);
    };
    loadCities();
  }, []);

  const formatCount = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K+';
    }
    return num + '+';
  };

  // Helper to determine image based on city name or fallback
  const CityIcon = ({ city }) => {
    const name = city.name.toLowerCase();
    
    // We use img-replace for visual fidelity to the design
    if (name.includes('delhi')) return <img alt="Delhi Gate Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1703083664356-a15a04d42e4c" />;
    if (name.includes('mumbai')) return <img alt="Gateway of India Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1518918249916-0a72d4f98658" />;
    if (name.includes('bengaluru') || name.includes('bangalore')) return <img alt="Vidhana Soudha Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1698127091046-3e260f65d6d8" />;
    if (name.includes('hyderabad')) return <img alt="Charminar Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1610341940372-5aab4d3786cb" />;
    if (name.includes('chennai')) return <img alt="Chennai Central Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1635472276754-a5369ebf1bba" />;
    if (name.includes('kolkata')) return <img alt="Howrah Bridge Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1571481808344-77708908c5a9" />;
    if (name.includes('jaipur')) return <img alt="Hawa Mahal Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1617516203158-1b87bb39caa7" />;
    if (name.includes('ahmedabad')) return <img alt="Ahmedabad Icon" className="w-full h-full object-contain p-2" src="https://images.unsplash.com/photo-1674783358278-bed2d6a4d57d" />;
    
    // Generic fallback
    return <MapPin className="w-8 h-8 text-gray-400" strokeWidth={1.5} />;
  };

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Find Suppliers from Top Cities</h2>
          <p className="text-gray-500 text-lg">Connect with verified suppliers across India's major business hubs</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
          {cities.map((city, index) => (
            <motion.div
              key={city.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/directory/city/${city.slug}`)}
              className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg hover:border-blue-100 transition-all cursor-pointer group h-full"
            >
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors overflow-hidden border border-gray-100">
                 <CityIcon city={city} />
              </div>
              <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition-colors">{city.name}</h3>
              <p className="text-sm text-gray-500 font-medium">{formatCount(city.supplier_count)} suppliers</p>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={() => navigate('/directory/cities')}
            className="bg-[#4F46E5] hover:bg-[#4338ca] text-white px-8 h-12 rounded-lg font-medium shadow-md shadow-blue-200"
          >
            View All Cities <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TopCitiesSection;
