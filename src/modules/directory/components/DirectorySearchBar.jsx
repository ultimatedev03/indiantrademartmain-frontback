import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locationService } from '@/shared/services/locationService';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { urlParser } from '@/shared/utils/urlParser';

const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * DirectorySearchBar
 * - Service/Product input
 * - State dropdown
 * - City dropdown (dependent on state)
 *
 * Navigates to: /directory/search/:service/:state?/:city?
 */
const DirectorySearchBar = ({
  initialService = '',
  initialState = '',
  initialCity = '',
  className = '',
  enableSuggestions = false,
}) => {
  const navigate = useNavigate();

  // Service text (what user sees) + service slug (what we use for URL)
  const [serviceText, setServiceText] = useState('');
  const [serviceSlug, setServiceSlug] = useState('');

  // Location selections are slugs
  const [selectedStateSlug, setSelectedStateSlug] = useState('');
  const [selectedCitySlug, setSelectedCitySlug] = useState('');

  // Data lists
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // Typeahead (optional)
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Sync with props (e.g. navigation)
  useEffect(() => {
    const s = initialService || '';
    setServiceSlug(s);
    setServiceText(s ? s.replace(/-/g, ' ') : '');

    setSelectedStateSlug(initialState || '');
    setSelectedCitySlug(initialCity || '');
  }, [initialService, initialState, initialCity]);

  // Load states
  useEffect(() => {
    const load = async () => {
      setLoadingStates(true);
      try {
        const data = await locationService.getStates();
        setStates(data || []);
      } finally {
        setLoadingStates(false);
      }
    };
    load();
  }, []);

  // Load cities whenever state changes
  useEffect(() => {
    const loadCities = async () => {
      if (!selectedStateSlug) {
        setCities([]);
        return;
      }
      setLoadingCities(true);
      try {
        const data = await locationService.getCitiesByStateSlug(selectedStateSlug);
        setCities(data || []);
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, [selectedStateSlug]);

  // If state changes, ensure city stays valid
  useEffect(() => {
    if (!selectedStateSlug) {
      if (selectedCitySlug) setSelectedCitySlug('');
      return;
    }
    if (selectedCitySlug && cities.length > 0) {
      const exists = cities.some((c) => c.slug === selectedCitySlug);
      if (!exists) setSelectedCitySlug('');
    }
  }, [cities, selectedCitySlug, selectedStateSlug]);

  // Suggestions debounce
  useEffect(() => {
    if (!enableSuggestions) return;

    const t = setTimeout(async () => {
      const q = serviceText?.trim();
      if (!q || q.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await directoryApi.searchMicroCategories(q);
        setSuggestions(res || []);
      } catch (e) {
        console.error('Suggestion search failed', e);
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [serviceText, enableSuggestions]);

  const canShowSuggestions = useMemo(
    () => enableSuggestions && showSuggestions && suggestions.length > 0,
    [enableSuggestions, showSuggestions, suggestions.length]
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalServiceSlug = serviceSlug || slugify(serviceText);
    if (!finalServiceSlug) return;

    const url = urlParser.createStructuredUrl(
      finalServiceSlug,
      selectedStateSlug || '',
      selectedCitySlug || ''
    );
    navigate(url);
  };

  return (
    <div className={`w-full bg-white shadow-sm border rounded-lg p-2 ${className}`}>
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2">
        {/* Service Input */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-2.5 text-gray-400">
            <Search className="w-5 h-5" />
          </div>

          <Input
            placeholder="Search product/service (e.g. Geotechnical Investigation)"
            className="pl-10 border-0 bg-transparent focus-visible:ring-0 md:border-r rounded-none"
            value={serviceText}
            onChange={(e) => {
              setServiceText(e.target.value);
              setServiceSlug(''); // user typed manually, clear selected suggestion slug
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 150);
            }}
          />

          {/* Suggestions dropdown (optional) */}
          {canShowSuggestions && (
            <div className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-xl mt-2 z-50 overflow-hidden text-left border border-gray-100">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full px-4 py-3 hover:bg-slate-50 text-left border-b last:border-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setServiceText(item.name);
                    setServiceSlug(item.slug);
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                >
                  <div className="font-medium text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.path}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* State Select */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-2.5 text-gray-400">
            <MapPin className="w-5 h-5" />
          </div>
          <select
            className="w-full h-10 pl-10 pr-8 bg-transparent border-0 focus:ring-0 text-sm text-gray-700 outline-none cursor-pointer appearance-none"
            value={selectedStateSlug}
            onChange={(e) => {
              setSelectedStateSlug(e.target.value);
              setSelectedCitySlug('');
            }}
            disabled={loadingStates}
          >
            <option value="">All India</option>
            {states.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>

          {loadingStates && (
            <div className="absolute right-3 top-2.5 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        {/* City Select */}
        <div className="flex-1 relative border-t md:border-t-0 md:border-l border-gray-100">
          <div className="absolute left-3 top-2.5 text-gray-400">
            <MapPin className="w-5 h-5" />
          </div>
          <select
            className="w-full h-10 pl-10 pr-8 bg-transparent border-0 focus:ring-0 text-sm text-gray-700 outline-none cursor-pointer appearance-none"
            value={selectedCitySlug}
            onChange={(e) => setSelectedCitySlug(e.target.value)}
            disabled={!selectedStateSlug || loadingCities}
          >
            <option value="">{selectedStateSlug ? 'All Cities' : 'Select State first'}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {loadingCities && (
            <div className="absolute right-3 top-2.5 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        <Button type="submit" className="bg-[#003D82] text-white px-8">
          Search
        </Button>
      </form>
    </div>
  );
};

export default DirectorySearchBar;