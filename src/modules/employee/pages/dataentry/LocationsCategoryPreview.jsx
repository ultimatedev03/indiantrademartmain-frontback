import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ChevronRight, ChevronDown, Plus, Trash2, AlertCircle, Eye } from 'lucide-react';
import { generateDynamicMeta } from '@/utils/metaHelper';

const LocationsCategoryPreview = () => {
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [headCategories, setHeadCategories] = useState([]);
  const [expandedHeads, setExpandedHeads] = useState({});
  const [subCategories, setSubCategories] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});
  const [microCategories, setMicroCategories] = useState({});
  const [microMeta, setMicroMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedMicroForPreview, setSelectedMicroForPreview] = useState(null);

  useEffect(() => {
    fetchStates();
    fetchHeadCategories();
  }, []);

  useEffect(() => {
    if (selectedState) {
      fetchCities(selectedState.id);
      // Auto-select first city
      setCities([]);
      setSelectedCity(null);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedCity && selectedCity.state_id === selectedState?.id) {
      // City is already loaded
    }
  }, [selectedCity, selectedState]);

  const fetchStates = async () => {
    try {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setStates(data || []);
      if (data && data.length > 0) {
        setSelectedState(data[0]);
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchCities = async (stateId) => {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('state_id', stateId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCities(data || []);
      if (data && data.length > 0) {
        setSelectedCity(data[0]);
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchHeadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('head_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setHeadCategories(data || []);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubCategories = async (headCategoryId) => {
    try {
      const { data, error } = await supabase
        .from('sub_categories')
        .select('*')
        .eq('head_category_id', headCategoryId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setSubCategories(prev => ({ ...prev, [headCategoryId]: data || [] }));
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchMicroCategories = async (subCategoryId) => {
    try {
      const { data, error } = await supabase
        .from('micro_categories')
        .select('*')
        .eq('sub_category_id', subCategoryId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setMicroCategories(prev => ({ ...prev, [subCategoryId]: data || [] }));
      
      // Fetch meta for each micro category
      if (data && data.length > 0) {
        data.forEach(micro => fetchMicroMeta(micro.id));
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchMicroMeta = async (microCategoryId) => {
    try {
      const { data, error } = await supabase
        .from('micro_categories_meta')
        .select('*')
        .eq('category_id', microCategoryId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      setMicroMeta(prev => ({ ...prev, [microCategoryId]: data || null }));
    } catch (error) {
      console.error('Error fetching meta:', error);
    }
  };

  const toggleHeadExpansion = (headId) => {
    if (expandedHeads[headId]) {
      setExpandedHeads(prev => ({ ...prev, [headId]: false }));
    } else {
      setExpandedHeads(prev => ({ ...prev, [headId]: true }));
      fetchSubCategories(headId);
    }
  };

  const toggleSubExpansion = (subId) => {
    if (expandedSubs[subId]) {
      setExpandedSubs(prev => ({ ...prev, [subId]: false }));
    } else {
      setExpandedSubs(prev => ({ ...prev, [subId]: true }));
      fetchMicroCategories(subId);
    }
  };

  if (loading || !selectedCity) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Category Preview by Location</h2>
        <p className="text-gray-600">See how meta tags and descriptions appear for each state and city</p>
      </div>

      {/* Location Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-semibold mb-2 block">Select State</Label>
          <select
            value={selectedState?.id || ''}
            onChange={e => {
              const state = states.find(s => s.id === e.target.value);
              setSelectedState(state);
            }}
            className="w-full p-2 border rounded-lg"
          >
            {states.map(state => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-2 block">Select City</Label>
          <select
            value={selectedCity?.id || ''}
            onChange={e => {
              const city = cities.find(c => c.id === e.target.value);
              setSelectedCity(city);
            }}
            className="w-full p-2 border rounded-lg"
          >
            {cities.map(city => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-900">
          <strong>👁️ Preview for:</strong> {selectedCity?.name}, {selectedState?.name}
        </p>
        <p className="text-xs text-green-700 mt-2">
          Below is how categories, meta tags, and descriptions will appear on the website for this location
        </p>
      </div>

      {/* Categories Tree with Dynamic Meta */}
      <div className="bg-white rounded border">
        <div className="p-4 border-b bg-gray-50">
          <p className="text-sm text-gray-600">Category hierarchy with location-specific meta tags and descriptions</p>
        </div>

        <div className="divide-y">
          {headCategories.map(headCategory => (
            <div key={headCategory.id} className="border-b">
              {/* HEAD CATEGORY */}
              <div 
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                onClick={() => toggleHeadExpansion(headCategory.id)}
              >
                {expandedHeads[headCategory.id] ? 
                  <ChevronDown className="w-5 h-5" /> : 
                  <ChevronRight className="w-5 h-5" />
                }
                <div className="flex-1">
                  <div className="font-semibold text-lg">{headCategory.name}</div>
                  <div className="text-xs text-gray-500">{headCategory.slug}</div>
                </div>
              </div>

              {/* SUB CATEGORIES */}
              {expandedHeads[headCategory.id] && (
                <div className="bg-gray-50 border-t">
                  {subCategories[headCategory.id]?.map(subCategory => (
                    <div key={subCategory.id} className="border-b">
                      <div 
                        className="p-4 ml-8 hover:bg-white cursor-pointer flex items-center gap-3"
                        onClick={() => toggleSubExpansion(subCategory.id)}
                      >
                        {expandedSubs[subCategory.id] ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                        <div className="flex-1">
                          <div className="font-medium">{subCategory.name}</div>
                          <div className="text-xs text-gray-500">{subCategory.slug}</div>
                        </div>
                      </div>

                      {/* MICRO CATEGORIES */}
                      {expandedSubs[subCategory.id] && (
                        <div className="bg-white border-t">
                          {microCategories[subCategory.id]?.map(microCategory => {
                            const baseMeta = microMeta[microCategory.id];
                            const dynamicMeta = generateDynamicMeta(baseMeta, selectedCity.name, selectedState.name);
                            
                            return (
                              <div key={microCategory.id} className="p-4 ml-16 border-b hover:bg-blue-50 flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{microCategory.name}</div>
                                  <div className="text-xs text-gray-500 mb-2">{microCategory.slug}</div>
                                  
                                  {/* Dynamic Meta Preview */}
                                  {baseMeta && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                                      <div className="text-xs">
                                        <p className="font-semibold text-yellow-900 mb-1">📌 Meta Tags for this location:</p>
                                        <p className="text-yellow-800">{dynamicMeta.dynamicMetaTags}</p>
                                        
                                        <p className="font-semibold text-yellow-900 mt-2 mb-1">📝 Description for this location:</p>
                                        <p className="text-yellow-800">{dynamicMeta.dynamicDescription}</p>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {!baseMeta && (
                                    <div className="text-xs text-gray-500 italic mt-2">
                                      No meta tags configured yet
                                    </div>
                                  )}
                                </div>

                                <Dialog open={selectedMicroForPreview?.id === microCategory.id} onOpenChange={(open) => {
                                  if (!open) setSelectedMicroForPreview(null);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => setSelectedMicroForPreview(microCategory)}
                                      className="gap-1 shrink-0"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View
                                    </Button>
                                  </DialogTrigger>
                                  
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>{microCategory.name} - Location Preview</DialogTitle>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4">
                                      <div>
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Location: {selectedCity.name}, {selectedState.name}</p>
                                      </div>

                                      {baseMeta ? (
                                        <>
                                          <div>
                                            <Label className="text-sm font-semibold">Meta Tags</Label>
                                            <div className="bg-gray-100 p-3 rounded mt-2 text-sm text-gray-800">
                                              {dynamicMeta.dynamicMetaTags}
                                            </div>
                                          </div>
                                          
                                          <div>
                                            <Label className="text-sm font-semibold">Description</Label>
                                            <div className="bg-gray-100 p-3 rounded mt-2 text-sm text-gray-800">
                                              {dynamicMeta.dynamicDescription}
                                            </div>
                                          </div>

                                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                            <p className="text-xs text-blue-900">
                                              <strong>✓ Base meta configured:</strong> Change location to see how it adapts
                                            </p>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-center p-4 text-gray-500">
                                          No meta tags configured for this category yet
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            );
                          }) || (
                            <div className="p-4 ml-16 text-sm text-gray-500">
                              No micro categories
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )) || (
                    <div className="p-4 ml-8 text-sm text-gray-500">
                      No sub categories
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {headCategories.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No categories found
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationsCategoryPreview;
