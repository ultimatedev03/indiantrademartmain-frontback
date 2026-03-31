import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { directoryApi } from "@/modules/directory/services/directoryApi";
import { vendorService } from "@/modules/directory/services/vendorService";
import Card from "@/shared/components/Card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, ShieldCheck, Search } from "lucide-react";
import { getVendorProfilePath } from "@/shared/utils/vendorRoutes";

const VendorListing = () => {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // ✅ Filters
  const [q, setQ] = useState(""); // search products/services/company
  const [cityText, setCityText] = useState(""); // city text input
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");

  // ✅ Trigger "Search" button
  const [applyTick, setApplyTick] = useState(0);

  const FETCH_LIMIT = 2000;

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        // NOTE: If Supabase RLS policy filters is_active=true, then inactive vendors won't come at all.
        const data = await vendorService.getFeaturedVendors({
          limit: FETCH_LIMIT,
          onlyActive: true,
          exhaustive: true,
        });

        setVendors(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to fetch vendors:", e);
        setVendors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, []);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const data = await directoryApi.getStates();
        setStates(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch states:", error);
        setStates([]);
      }
    };

    fetchStates();
  }, []);

  useEffect(() => {
    setSelectedCityId("");

    if (!selectedStateId) {
      setCities([]);
      setCitiesLoading(false);
      return;
    }

    let active = true;

    const fetchCities = async () => {
      setCitiesLoading(true);
      try {
        const data = await directoryApi.getCities(selectedStateId);
        if (active) {
          setCities(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch cities:", error);
        if (active) {
          setCities([]);
        }
      } finally {
        if (active) {
          setCitiesLoading(false);
        }
      }
    };

    fetchCities();

    return () => {
      active = false;
    };
  }, [selectedStateId]);

  const selectedStateName = useMemo(() => {
    const match = states.find((state) => String(state?.id || "") === String(selectedStateId || ""));
    return String(match?.name || "").trim();
  }, [states, selectedStateId]);

  const selectedCityName = useMemo(() => {
    const match = cities.find((city) => String(city?.id || "") === String(selectedCityId || ""));
    return String(match?.name || "").trim();
  }, [cities, selectedCityId]);

  // ✅ filtering logic (applies when applyTick changes OR when vendors change)
  const filteredVendors = useMemo(() => {
    // only apply after user clicks Search (applyTick)
    // but we also want initial list => if applyTick=0, show all vendors
    if (applyTick === 0) return vendors;

    const query = q.trim().toLowerCase();
    const cityQ = cityText.trim().toLowerCase();

    return vendors.filter((v) => {
      const company = String(v?.company_name || v?.name || "").toLowerCase();
      const vendorName = String(v?.name || "").toLowerCase();
      const ownerName = String(v?.owner_name || "").toLowerCase();
      const city = String(v?.city || "").toLowerCase();
      const state = String(v?.state || "").toLowerCase();
      const primary = String(v?.primary_business_type || "").toLowerCase();
      const secondary = String(v?.secondary_business || "").toLowerCase();
      const description = String(v?.description || "").toLowerCase();
      const slug = String(v?.slug || "").toLowerCase();

      // dropdown filters
      if (selectedStateId) {
        const vendorStateId = String(v?.state_id || "").trim();
        const vendorStateName = String(v?.state || "").trim().toLowerCase();
        if (
          vendorStateId !== String(selectedStateId) &&
          vendorStateName !== String(selectedStateName || "").trim().toLowerCase()
        ) {
          return false;
        }
      }
      if (selectedCityId) {
        const vendorCityId = String(v?.city_id || "").trim();
        const vendorCityName = String(v?.city || "").trim().toLowerCase();
        if (
          vendorCityId !== String(selectedCityId) &&
          vendorCityName !== String(selectedCityName || "").trim().toLowerCase()
        ) {
          return false;
        }
      }

      // city text input
      if (cityQ && !city.includes(cityQ)) return false;

      // main search input
      if (query) {
        const match =
          company.includes(query) ||
          vendorName.includes(query) ||
          ownerName.includes(query) ||
          primary.includes(query) ||
          secondary.includes(query) ||
          description.includes(query) ||
          city.includes(query) ||
          state.includes(query) ||
          slug.includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [vendors, q, cityText, selectedStateId, selectedCityId, selectedStateName, selectedCityName, applyTick]);

  const VendorImage = ({ src, name }) => {
    const [failed, setFailed] = useState(false);
    const letter = String(name || "S").trim().charAt(0).toUpperCase() || "S";

    if (!src || failed) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-3xl font-extrabold text-slate-300">
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

  const onSearch = () => {
    setApplyTick((x) => x + 1);
  };

  const onReset = () => {
    setQ("");
    setCityText("");
    setSelectedStateId("");
    setSelectedCityId("");
    setApplyTick(0);
  };

  const citySelectDisabled = !selectedStateId || citiesLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">All Vendors</h1>
            {!loading && (
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold">{filteredVendors.length}</span> vendors
              </p>
            )}
          </div>

          {!loading && (
            <button
              type="button"
              onClick={onReset}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="mt-4 bg-white border rounded-xl shadow-sm p-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px_120px_140px_140px] gap-3 items-center">
            {/* Search */}
            <div className="flex items-center border rounded-lg px-3 h-11">
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products or services..."
                className="w-full outline-none text-sm"
              />
            </div>

            {/* City text */}
            <div className="flex items-center border rounded-lg px-3 h-11">
              <MapPin className="w-4 h-4 text-gray-400 mr-2" />
              <input
                value={cityText}
                onChange={(e) => setCityText(e.target.value)}
                placeholder="Enter city name..."
                className="w-full outline-none text-sm"
              />
            </div>

            {/* Search button */}
            <Button className="h-11" onClick={onSearch}>
              Search
            </Button>

            {/* State dropdown */}
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="border rounded-lg px-3 h-11 bg-white text-sm"
            >
              <option value="">All States</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>

            {/* City dropdown */}
            <select
              value={selectedCityId}
              key={selectedStateId || 'all-states'}
              onChange={(e) => setSelectedCityId(e.target.value)}
              disabled={citySelectDisabled}
              aria-disabled={citySelectDisabled}
              title={!selectedStateId ? "Select a state first" : citiesLoading ? "Loading cities..." : "Select a city"}
              className="border rounded-lg px-3 h-11 bg-white text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {!selectedStateId ? (
                <option value="">Select state first</option>
              ) : citiesLoading ? (
                <option value="">Loading cities...</option>
              ) : (
                <>
                  <option value="">All Cities</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <div className="col-span-full text-center text-gray-500 py-10">Loading vendors...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-10">
            No vendors found for current filters.
          </div>
        ) : (
          filteredVendors.map((vendor) => (
            <Card
              key={vendor.id}
              className="group hover:shadow-md transition-all cursor-pointer border border-slate-200"
              onClick={() => navigate(getVendorProfilePath(vendor) || '/directory/vendor')}
            >
              <Card.Content className="p-0">
                <div className="p-2">
                  <div className="relative h-20 rounded-lg bg-slate-50 overflow-hidden">
                    <VendorImage src={vendor.image} name={vendor.name} />

                    {vendor.verified && (
                      <span className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 text-emerald-700 shadow-sm">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-3 pb-3 pt-0 flex flex-col gap-2 min-h-[104px]">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-[13px] text-slate-900 line-clamp-1">
                      {vendor.name}
                    </h3>
                    {vendor.rating !== null && vendor.rating !== undefined && Number(vendor.rating) > 0 && (
                      <span className="inline-flex items-center bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3 mr-1 fill-amber-600 text-amber-600" />
                        {Number(vendor.rating).toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3 mr-1" />
                    {vendor.city || "-"}
                    {vendor.state ? `, ${vendor.state}` : ""}
                  </div>

                  {(vendor.description || vendor.primary_business_type) && (
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {vendor.description || vendor.primary_business_type}
                    </p>
                  )}

                  <Button
                    variant="outline"
                    className="w-full h-7 text-[11px] mt-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(getVendorProfilePath(vendor) || '/directory/vendor');
                    }}
                  >
                    View Profile
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default VendorListing;
