import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';

const CityPage = () => {
  const navigate = useNavigate();
  const { citySlug } = useParams();

  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState(null);
  const [state, setState] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: cityData, error: cityErr } = await supabase
          .from('cities')
          .select('id, name, slug, supplier_count, state_id')
          .eq('slug', citySlug)
          .single();

        if (cityErr || !cityData) {
          setCity(null);
          setState(null);
          return;
        }

        setCity(cityData);

        if (cityData.state_id) {
          const { data: stateData } = await supabase
            .from('states')
            .select('id, name, slug')
            .eq('id', cityData.state_id)
            .single();
          setState(stateData || null);
        } else {
          setState(null);
        }
      } catch (e) {
        console.error('Failed to load city page', e);
        setCity(null);
        setState(null);
      } finally {
        setLoading(false);
      }
    };

    if (citySlug) load();
  }, [citySlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (!city) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="text-2xl font-bold text-slate-900">City not found</div>
        <p className="text-slate-600 mt-2">Please choose a city from the list.</p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/directory/cities"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 font-semibold"
          >
            Browse Cities
          </Link>
          <Link
            to="/directory"
            className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-blue-500 text-slate-800 px-5 py-2.5 font-semibold"
          >
            Browse Directory
          </Link>
        </div>
      </div>
    );
  }

  const title = `${city.name}${state?.name ? `, ${state.name}` : ''} Suppliers | IndianTradeMart`;
  const desc = `Find suppliers and products in ${city.name}${state?.name ? `, ${state.name}` : ''} on IndianTradeMart.`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
      </Helmet>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                className="px-2"
                onClick={() => navigate(-1)}
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <MapPin className="w-4 h-4" />
                  <Link to="/directory" className="hover:text-blue-700">IndianTradeMart</Link>
                  <span>/</span>
                  <Link to="/directory/cities" className="hover:text-blue-700">Cities</Link>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 truncate mt-1">
                  Suppliers in {city.name}{state?.name ? `, ${state.name}` : ''}
                </h1>
                {Number(city.supplier_count || 0) > 0 && (
                  <p className="text-sm text-slate-600 mt-1">
                    {Number(city.supplier_count || 0).toLocaleString('en-IN')} suppliers available
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 max-w-4xl">
              {/* Pre-fill location so user can search any service inside this city */}
              <DirectorySearchBar
                enableSuggestions
                initialState={state?.slug || ''}
                initialCity={city.slug}
                className="shadow-sm"
              />
              <p className="text-xs text-slate-500 mt-2">
                Tip: Type a product/service and hit search to see results filtered for this city.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="container mx-auto px-4 py-10">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-lg font-semibold text-slate-900">What next?</div>
            <ul className="mt-3 text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Use the search box above to find suppliers by product/service in this city.</li>
              <li>Or browse industries from the directory page and then apply location using the search bar.</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/directory"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 font-semibold"
              >
                Browse Industries
              </Link>
              <Link
                to="/directory/cities"
                className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-blue-500 text-slate-800 px-5 py-2.5 font-semibold"
              >
                View All Cities
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CityPage;
