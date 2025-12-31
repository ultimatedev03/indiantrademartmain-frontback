
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/services/directoryApi';
import { motion } from 'framer-motion';

const PremiumBrandsSection = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    const loadBrands = async () => {
      const data = await directoryApi.getBrands();
      setBrands(data || []);
    };
    loadBrands();
  }, []);

  // Helper to get image based on brand name (Simulating the logo seeding)
  const BrandLogo = ({ brand }) => {
    const name = brand.name.toUpperCase();
    
    // Using img-replace to fetch actual relevant logos
    if (name.includes('BSH')) return <img alt="BSH Infra Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1649734927719-9ce8abaf042c" />;
    if (name.includes('EIMAGER')) return <img alt="Eimager Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1572836227378-f97bbb4af7d5" />;
    if (name.includes('PDCE')) return <img alt="PDCE Group Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1539369189415-69494ea05342" />;
    if (name.includes('SRI')) return <img alt="SRIS Tech Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1658203897456-14cdc8e81146" />;
    if (name.includes('BSREALTY')) return <img alt="BS Realty Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1691354103779-bfdacb7ab8c9" />;
    if (name.includes('STARTUP')) return <img alt="Startup Business India Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1692113232379-f4018eea2c69" />;
    if (name.includes('INDORE')) return <img alt="Indore Chamber Logo" className="max-h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all" src="https://images.unsplash.com/photo-1619708838487-d18b744f2ea4" />;

    return <span className="font-bold text-gray-400">{brand.name}</span>;
  };

  return (
    <section className="py-16 bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">Explore products from <span className="text-[#4F46E5]">Premium Brands</span></h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-8 items-center justify-items-center">
          {brands.map((brand, index) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/directory/brand/${brand.slug}`)}
              className="w-full flex justify-center cursor-pointer hover:scale-110 transition-transform duration-300"
            >
              <BrandLogo brand={brand} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PremiumBrandsSection;
