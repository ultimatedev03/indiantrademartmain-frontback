
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { categoryApi } from '@/modules/directory/services/categoryApi';
import { StateDropdown, CityDropdown } from '@/shared/components/LocationSelectors';
import QuoteModal from '@/shared/components/QuoteModal';

const Directory = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  
  // Search State
  const [selectedService, setSelectedService] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [serviceSlug, setServiceSlug] = useState("");
  const [stateSlug, setStateSlug] = useState("");
  const [citySlug, setCitySlug] = useState("");

  useEffect(() => {
    categoryApi.getTopLevelCategories().then(data => {
        if(data) setCategories(data.slice(0, 12)); // Show top 12
    });
  }, []);

  const handleServiceChange = (e) => {
    const name = e.target.value;
    setSelectedService(name);
    // Find slug
    const cat = categories.find(c => c.name === name); // Simplified matching
    if(cat) setServiceSlug(cat.slug);
    else setServiceSlug(name.toLowerCase().replace(/\s+/g, '-'));
  };

  const handleSearch = () => {
    if(!serviceSlug) return;
    
    let url = `/directory/${serviceSlug}`;
    if (stateSlug) {
        url += `/${stateSlug}`;
        if (citySlug) {
            url += `/${citySlug}`;
        }
    } else {
        // If only service is selected, default to search
        url = `/categories/${serviceSlug}`;
    }
    
    navigate(url);
  };

  return (
    <>
      <Helmet>
        <title>Indian Trade Mart - B2B Directory</title>
      </Helmet>

      <div className="bg-gray-50 min-h-screen pb-20">
        
        {/* Direct Search Bar Header */}
        <div className="bg-white border-b sticky top-16 z-20 shadow-sm py-4">
            <div className="container mx-auto px-4">
                <div className="flex gap-4 max-w-4xl mx-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <Input placeholder="Search products, categories, vendors..." className="pl-10 h-11 bg-gray-50" />
                    </div>
                    <Button className="h-11 px-8 bg-[#003D82]">Search</Button>
                </div>
            </div>
        </div>

        {/* Main Hero / Steps Section */}
        <div className="container mx-auto px-4 mt-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-5xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Find Service Providers Step by Step</h1>
                    <p className="text-gray-500">Select service type, then state, and finally city to find the best providers</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    {/* Step 1: Service */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">1. Select Service Type</label>
                        <select 
                            className="w-full h-10 border rounded-md px-3 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedService}
                            onChange={handleServiceChange}
                        >
                            <option value="">Choose a service...</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: State */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">2. Select State</label>
                        <StateDropdown 
                            value={selectedState} 
                            onChange={(id, item) => { setSelectedState(id); setStateSlug(item.slug); }} 
                        />
                    </div>

                    {/* Step 3: City */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">3. Select City</label>
                        <CityDropdown 
                            stateId={selectedState} 
                            value={selectedCity} 
                            onChange={(id, item) => { setSelectedCity(id); setCitySlug(item.slug); }} 
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-center gap-4">
                    <Button 
                        onClick={handleSearch} 
                        className="bg-[#003D82] text-white px-8 h-12 text-lg w-full md:w-auto hover:bg-[#002a5c]"
                        disabled={!selectedService}
                    >
                        Find Providers
                    </Button>
                    <QuoteModal triggerText="Get a Quote Quickly" />
                </div>
                
                {/* Visual Steps Indicator */}
                <div className="flex justify-center mt-8 gap-4 text-gray-300 font-bold">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${selectedService ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>1</span>
                    <div className="w-12 h-0.5 bg-gray-200 self-center"></div>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${selectedState ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>2</span>
                    <div className="w-12 h-0.5 bg-gray-200 self-center"></div>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${selectedCity ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>3</span>
                </div>
            </div>
        </div>

        {/* Popular Categories */}
        <div className="container mx-auto px-4 mt-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Popular Service Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((cat, idx) => (
                    <div 
                        key={cat.id} 
                        onClick={() => navigate(`/categories/${cat.slug}`)}
                        className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all group"
                    >
                        <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600">{cat.name}</h3>
                        <p className="text-sm text-gray-500 mb-3">Find providers</p>
                        <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            View All <ArrowRight className="w-3 h-3" />
                        </span>
                    </div>
                ))}
            </div>
        </div>

        {/* How It Works */}
        <div className="container mx-auto px-4 mt-16 mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-8">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-blue-600">1</div>
                    <h3 className="font-bold text-lg mb-2">Search</h3>
                    <p className="text-gray-500 text-sm">Search for the service or product you need in your specific location</p>
                </div>
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">2</div>
                    <h3 className="font-bold text-lg mb-2">Compare</h3>
                    <p className="text-gray-500 text-sm">Compare providers based on ratings, reviews, and experience</p>
                </div>
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-purple-600">3</div>
                    <h3 className="font-bold text-lg mb-2">Connect</h3>
                    <p className="text-gray-500 text-sm">Contact the best providers and get your work done efficiently</p>
                </div>
            </div>
        </div>

      </div>
    </>
  );
};

export default Directory;
