import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locationService } from '@/shared/services/locationService';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { urlParser } from '@/shared/utils/urlParser';
import { supabase } from '@/lib/customSupabaseClient';

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

// ✅ Resolve free-text location like "Delhi" / "New Delhi" to state/city slugs.
// Used when user types: "land survey in delhi" without selecting dropdowns.
const resolveLocationSlugs = async (locText) => {
  const clean = (locText || '').trim();
  if (!clean) return { stateSlug: '', citySlug: '' };

  const locSlug = slugify(clean);

  // 1) Try CITY by slug
  try {
    const { data: cityBySlug } = await supabase
      .from('cities')
      .select('slug, state_id, name')
      .eq('slug', locSlug)
      .maybeSingle();

    if (cityBySlug?.slug && cityBySlug?.state_id) {
      const { data: st } = await supabase
        .from('states')
        .select('slug, name')
        .eq('id', cityBySlug.state_id)
        .maybeSingle();

      return { stateSlug: st?.slug || '', citySlug: cityBySlug.slug };
    }
  } catch {
    // ignore
  }

  // 2) Try STATE by slug
  try {
    const { data: stateBySlug } = await supabase
      .from('states')
      .select('slug, name')
      .eq('slug', locSlug)
      .maybeSingle();

    if (stateBySlug?.slug) {
      return { stateSlug: stateBySlug.slug, citySlug: '' };
    }
  } catch {
    // ignore
  }

  // 3) Fallback: name partial match (city first)
  try {
    const { data: cities } = await supabase
      .from('cities')
      .select('slug, state_id, name')
      .ilike('name', `%${clean}%`)
      .limit(1);

    const city = cities?.[0];
    if (city?.slug && city?.state_id) {
      const { data: st } = await supabase
        .from('states')
        .select('slug, name')
        .eq('id', city.state_id)
        .maybeSingle();

      return { stateSlug: st?.slug || '', citySlug: city.slug };
    }
  } catch {
    // ignore
  }

  try {
    const { data: states } = await supabase
      .from('states')
      .select('slug, name')
      .ilike('name', `%${clean}%`)
      .limit(1);

    const st = states?.[0];
    if (st?.slug) {
      return { stateSlug: st.slug, citySlug: '' };
    }
  } catch {
    // ignore
  }

  return { stateSlug: '', citySlug: '' };
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

  // Submit loading (for resolving "... in delhi" to slugs)
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    // ✅ If user did NOT pick state/city but typed "service in delhi", auto-parse location.
    let finalServiceText = (serviceText || '').trim();
    let freeLocText = '';

    if (!selectedStateSlug && !selectedCitySlug) {
      const m = finalServiceText.match(/^(.*)\s+in\s+(.+)$/i);
      if (m && m[1] && m[2]) {
        finalServiceText = m[1].trim();
        freeLocText = m[2].trim();
      }
    }

    const finalServiceSlug = serviceSlug || slugify(finalServiceText);
    if (!finalServiceSlug) return;

    // If dropdowns already selected, use them.
    if (selectedStateSlug || selectedCitySlug) {
      const url = urlParser.createStructuredUrl(finalServiceSlug, selectedStateSlug || '', selectedCitySlug || '');
      navigate(url);
      return;
    }

    // If no dropdowns selected but we extracted location from query, resolve it to slugs.
    if (freeLocText) {
      setSubmitting(true);
      try {
        const resolved = await resolveLocationSlugs(freeLocText);

        // Update UI inputs so user sees clean service text
        setServiceText(finalServiceText);
        setServiceSlug('');

        if (resolved?.stateSlug || resolved?.citySlug) {
          const url = urlParser.createStructuredUrl(finalServiceSlug, resolved.stateSlug || '', resolved.citySlug || '');
          navigate(url);
        } else {
          // Fallback: still pass loc text for filtering on results page
          const sp = new URLSearchParams();
          sp.set('loc', freeLocText);
          navigate(`/directory/search/${finalServiceSlug}?${sp.toString()}`);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Default: no location
    const url = urlParser.createStructuredUrl(finalServiceSlug, '', '');
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

        <Button type="submit" className="bg-[#003D82] text-white px-8" disabled={submitting}>
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </Button>
      </form>
    </div>
  );
};

export default DirectorySearchBar;
