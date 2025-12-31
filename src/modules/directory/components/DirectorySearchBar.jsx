
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locationService } from '@/shared/services/locationService';
import { categoryApi } from '@/modules/directory/services/categoryApi';
import { urlParser } from '@/shared/utils/urlParser';

const DirectorySearchBar = ({ initialService = '', initialState = '', initialCity = '', className }) => {
  const navigate = useNavigate();
  
  // State for form values
  const [serviceQuery, setServiceQuery] = useState(initialService);
  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  
  // Data lists
  const [states, setStates] = useState([]);
  
  useEffect(() => {
    // Sync with props if they change (e.g. navigation)
    setServiceQuery(initialService ? initialService.replace(/-/g, ' ') : '');
    setSelectedState(initialState);
    setSelectedCity(initialCity);
  }, [initialService, initialState, initialCity]);

  useEffect(() => {
    const loadStates = async () => {
      const data = await locationService.getStates();
      setStates(data || []);
    };
    loadStates();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    
    // Convert display name to slug roughly
    const sSlug = serviceQuery.toLowerCase().trim().replace(/\s+/g, '-');
    const stateObj = states.find(s => s.slug === selectedState || s.id === selectedState);
    const stSlug = stateObj ? stateObj.slug : selectedState;
    const cSlug = selectedCity ? selectedCity.toLowerCase().trim().replace(/\s+/g, '-') : '';

    if (!sSlug) return; // Need at least a service

    // Decide format. Defaulting to Structured for manual searches as it is cleaner
    // But user asked for 3 formats support. Let's use Structured: /directory/service/state/city
    const url = urlParser.createStructuredUrl(sSlug, stSlug, cSlug);
    navigate(url);
  };

  return (
    <div className={`w-full bg-white shadow-sm border rounded-lg p-2 ${className}`}>
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
        {/* Service Input */}
        <div className="flex-1 relative">
           <div className="absolute left-3 top-2.5 text-gray-400">
             <Search className="w-5 h-5" />
           </div>
           <Input 
             placeholder="Search service (e.g. Geotechnical Investigation)" 
             className="pl-10 border-0 bg-transparent focus-visible:ring-0 md:border-r rounded-none"
             value={serviceQuery}
             onChange={(e) => setServiceQuery(e.target.value)}
           />
        </div>

        {/* State/Location Input (Simplified for demo to State text/select) */}
        <div className="flex-1 relative">
           <div className="absolute left-3 top-2.5 text-gray-400">
             <MapPin className="w-5 h-5" />
           </div>
           <select 
              className="w-full h-10 pl-10 pr-3 bg-transparent border-0 focus:ring-0 text-sm text-gray-700 outline-none cursor-pointer appearance-none"
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setSelectedCity(''); }}
           >
              <option value="">Select State</option>
              {states.map(s => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
           </select>
        </div>
        
        {/* City Input */}
        <div className="flex-1 relative border-t md:border-t-0 md:border-l border-gray-100">
           <div className="absolute left-3 top-2.5 text-gray-400">
             <MapPin className="w-5 h-5" />
           </div>
           <Input 
             placeholder="Enter City" 
             className="pl-10 border-0 bg-transparent focus-visible:ring-0"
             value={selectedCity}
             onChange={(e) => setSelectedCity(e.target.value)}
           />
        </div>

        <Button type="submit" className="bg-[#003D82] text-white px-8">
          Search
        </Button>
      </form>
    </div>
  );
};

export default DirectorySearchBar;
