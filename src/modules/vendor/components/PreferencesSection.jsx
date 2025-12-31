import React, { useEffect, useState } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Loader2, X, Save } from 'lucide-react';

const PreferencesSection = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    preferred_micro_categories: [],
    preferred_states: [],
    preferred_cities: [],
    min_budget: 0,
    max_budget: 999999,
    auto_lead_filter: true
  });

  const [allStates, setAllStates] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prefs, states, categories] = await Promise.all([
        vendorApi.preferences.get(),
        vendorApi.getStates(),
        vendorApi.categories.getAllMicroCategories()
      ]);

      setPreferences(prefs);
      setAllStates(states || []);
      setAllCategories(categories || []);

      // Load cities for first selected state
      if (prefs.preferred_states?.length > 0) {
        const cities = await vendorApi.getCities(prefs.preferred_states[0]);
        setAllCities(cities || []);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error loading preferences',
        description: e?.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddState = async () => {
    if (!selectedStateId) return;
    if (preferences.preferred_states.includes(selectedStateId)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }

    // Load cities for this state
    const cities = await vendorApi.getCities(selectedStateId);
    setAllCities(cities || []);

    setPreferences(prev => ({
      ...prev,
      preferred_states: [...prev.preferred_states, selectedStateId]
    }));
    setSelectedStateId('');
  };

  const handleAddCity = async () => {
    if (!selectedCityId) return;
    if (preferences.preferred_cities.includes(selectedCityId)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }

    setPreferences(prev => ({
      ...prev,
      preferred_cities: [...prev.preferred_cities, selectedCityId]
    }));
    setSelectedCityId('');
  };

  const handleAddCategory = async () => {
    if (!selectedCategoryId) return;
    if (preferences.preferred_micro_categories.includes(selectedCategoryId)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }

    setPreferences(prev => ({
      ...prev,
      preferred_micro_categories: [...prev.preferred_micro_categories, selectedCategoryId]
    }));
    setSelectedCategoryId('');
  };

  const handleRemoveState = (id) => {
    setPreferences(prev => ({
      ...prev,
      preferred_states: prev.preferred_states.filter(s => s !== id)
    }));
  };

  const handleRemoveCity = (id) => {
    setPreferences(prev => ({
      ...prev,
      preferred_cities: prev.preferred_cities.filter(c => c !== id)
    }));
  };

  const handleRemoveCategory = (id) => {
    setPreferences(prev => ({
      ...prev,
      preferred_micro_categories: prev.preferred_micro_categories.filter(c => c !== id)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await vendorApi.preferences.update(preferences);
      toast({
        title: 'Preferences Updated',
        className: 'bg-green-50 text-green-900 border-green-200'
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Update Failed',
        description: e?.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const getStateName = (id) => allStates.find(s => s.id === id)?.name || id;
  const getCityName = (id) => allCities.find(c => c.id === id)?.name || id;
  const getCategoryName = (id) => allCategories.find(c => c.id === id)?.name || id;

  return (
    <div className="space-y-6">
      {/* States */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Preferred States</h3>
            <p className="text-sm text-gray-500 mb-4">Select states where you operate or want to receive leads from</p>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a state</option>
              {allStates.map(state => (
                <option key={state.id} value={state.id}>{state.name}</option>
              ))}
            </select>
            <Button onClick={handleAddState} variant="outline">Add</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {preferences.preferred_states.map(stateId => (
              <Badge key={stateId} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                {getStateName(stateId)}
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveState(stateId)} />
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Cities */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Preferred Cities</h3>
            <p className="text-sm text-gray-500 mb-4">Select specific cities for more targeted leads</p>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a city</option>
              {allCities.map(city => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
            <Button onClick={handleAddCity} variant="outline">Add</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {preferences.preferred_cities.map(cityId => (
              <Badge key={cityId} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                {getCityName(cityId)}
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveCity(cityId)} />
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Categories */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Product Categories</h3>
            <p className="text-sm text-gray-500 mb-4">Select categories your business deals in</p>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a category</option>
              {allCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <Button onClick={handleAddCategory} variant="outline">Add</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {preferences.preferred_micro_categories.map(catId => (
              <Badge key={catId} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                {getCategoryName(catId)}
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveCategory(catId)} />
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Budget Range */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Budget Range (₹)</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Minimum Budget</Label>
              <Input
                type="number"
                value={preferences.min_budget}
                onChange={(e) => setPreferences(prev => ({ ...prev, min_budget: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Maximum Budget</Label>
              <Input
                type="number"
                value={preferences.max_budget}
                onChange={(e) => setPreferences(prev => ({ ...prev, max_budget: parseInt(e.target.value) || 999999 }))}
                placeholder="999999"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Auto Filter */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Auto Lead Filter</h3>
            <p className="text-sm text-gray-500">Automatically filter leads based on your preferences</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.auto_lead_filter}
              onChange={(e) => setPreferences(prev => ({ ...prev, auto_lead_filter: e.target.checked }))}
              className="w-5 h-5"
            />
          </label>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#003D82] hover:bg-[#003D82]/90 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};

export default PreferencesSection;
