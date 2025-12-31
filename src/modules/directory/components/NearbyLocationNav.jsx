
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { locationService } from '@/shared/services/locationService';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const NearbyLocationNav = ({ serviceSlug, stateSlug, currentCitySlug }) => {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCities = async () => {
      if (!stateSlug) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const data = await locationService.getCitiesByStateSlug(stateSlug);
      // Filter out current city to avoid redundancy in suggestions
      const filtered = data.filter(c => c.slug !== currentCitySlug);
      setCities(filtered);
      setLoading(false);
    };

    fetchCities();
  }, [stateSlug, currentCitySlug]);

  if (!stateSlug) return null; // Don't show if no state is selected context

  return (
    <div className="w-full mt-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nearby in {stateSlug.replace(/-/g, ' ')}</span>
      </div>
      
      <div className="flex overflow-x-auto pb-2 gap-3 scrollbar-hide">
        {loading ? (
           Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />)
        ) : (
            <>
              {cities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => navigate(`/directory/${serviceSlug}/${stateSlug}/${city.slug}`)}
                  className={cn(
                    "flex-shrink-0 px-4 py-1.5 rounded-full border text-sm font-medium transition-all",
                    "bg-white border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-sm"
                  )}
                >
                  {city.name}
                </button>
              ))}
              
              {cities.length > 0 && (
                  <button 
                    onClick={() => navigate(`/directory/${serviceSlug}`)}
                    className="flex-shrink-0 px-4 py-1.5 rounded-full border border-dashed border-gray-300 text-sm text-gray-500 hover:text-blue-600 hover:border-blue-400"
                  >
                    View Other States
                  </button>
              )}
              
              {cities.length === 0 && (
                <span className="text-sm text-gray-400 italic px-2">No other cities found nearby.</span>
              )}
            </>
        )}
      </div>
    </div>
  );
};

export default NearbyLocationNav;
