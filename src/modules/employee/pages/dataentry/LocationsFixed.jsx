import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';

const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

const normalizePincode = (value = '') => String(value || '').replace(/\D/g, '').slice(0, 6);

const splitPincodes = (value = '') => {
  const raw = String(value || '')
    .split(/[,\s\n]+/g)
    .map((x) => normalizePincode(x))
    .filter((x) => x.length === 6);
  return [...new Set(raw)];
};

const LocationsFixed = () => {
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [pincodes, setPincodes] = useState([]);

  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [pincodeFilter, setPincodeFilter] = useState('');

  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedDivisionId, setSelectedDivisionId] = useState('');

  const [showStateDialog, setShowStateDialog] = useState(false);
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [showDivisionDialog, setShowDivisionDialog] = useState(false);

  const [stateForm, setStateForm] = useState({ id: '', name: '' });
  const [cityForm, setCityForm] = useState({ id: '', name: '' });
  const [divisionForm, setDivisionForm] = useState({
    id: '',
    name: '',
    district_name: '',
    subdistrict_name: '',
  });
  const [pincodeInput, setPincodeInput] = useState('');

  const [saving, setSaving] = useState(false);

  const selectedState = useMemo(
    () => states.find((s) => s.id === selectedStateId) || null,
    [states, selectedStateId]
  );
  const selectedCity = useMemo(
    () => cities.find((c) => c.id === selectedCityId) || null,
    [cities, selectedCityId]
  );
  const selectedDivision = useMemo(
    () => divisions.find((d) => d.id === selectedDivisionId) || null,
    [divisions, selectedDivisionId]
  );

  const filteredStates = useMemo(() => {
    const term = String(stateFilter || '').trim().toLowerCase();
    if (!term) return states;
    return states.filter((s) =>
      [s.name, s.slug].filter(Boolean).some((x) => String(x).toLowerCase().includes(term))
    );
  }, [states, stateFilter]);

  const filteredCities = useMemo(() => {
    const term = String(cityFilter || '').trim().toLowerCase();
    if (!term) return cities;
    return cities.filter((c) =>
      [c.name, c.slug].filter(Boolean).some((x) => String(x).toLowerCase().includes(term))
    );
  }, [cities, cityFilter]);

  const filteredDivisions = useMemo(() => {
    const term = String(divisionFilter || '').trim().toLowerCase();
    if (!term) return divisions;
    return divisions.filter((d) =>
      [d.name, d.slug, d.district_name, d.subdistrict_name, d.pincode_count]
        .filter((x) => x !== null && x !== undefined)
        .some((x) => String(x).toLowerCase().includes(term))
    );
  }, [divisions, divisionFilter]);

  const filteredPincodes = useMemo(() => {
    const term = String(pincodeFilter || '').trim();
    if (!term) return pincodes;
    return pincodes.filter((p) => String(p.pincode || '').includes(term));
  }, [pincodes, pincodeFilter]);

  const withToastError = (title, error) => {
    toast({
      title,
      description: error?.message || 'Please try again',
      variant: 'destructive',
    });
  };

  const fetchStates = async () => {
    const { data, error } = await supabase
      .from('states')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    const rows = data || [];
    setStates(rows);

    if (!rows.length) {
      setSelectedStateId('');
      return;
    }

    if (!rows.find((s) => s.id === selectedStateId)) {
      setSelectedStateId(rows[0].id);
    }
  };

  const fetchCities = async (stateId) => {
    if (!stateId) {
      setCities([]);
      setSelectedCityId('');
      return;
    }

    const { data, error } = await supabase
      .from('cities')
      .select('id, name, slug, state_id, is_active')
      .eq('state_id', stateId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    const rows = data || [];
    setCities(rows);

    if (!rows.length) {
      setSelectedCityId('');
      return;
    }

    if (!rows.find((c) => c.id === selectedCityId)) {
      setSelectedCityId(rows[0].id);
    }
  };

  const fetchDivisions = async (cityId) => {
    if (!cityId) {
      setDivisions([]);
      setSelectedDivisionId('');
      return;
    }

    const { data, error } = await supabase
      .from('geo_divisions')
      .select(
        'id, name, slug, city_id, state_id, district_name, subdistrict_name, pincode_count, is_active, division_key'
      )
      .eq('city_id', cityId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    const rows = data || [];
    setDivisions(rows);

    if (!rows.length) {
      setSelectedDivisionId('');
      return;
    }

    if (!rows.find((d) => d.id === selectedDivisionId)) {
      setSelectedDivisionId(rows[0].id);
    }
  };

  const fetchDivisionPincodes = async (divisionId) => {
    if (!divisionId) {
      setPincodes([]);
      return;
    }

    const { data, error } = await supabase
      .from('geo_division_pincodes')
      .select('id, pincode, source_district_name, source_subdistrict_name')
      .eq('division_id', divisionId)
      .order('pincode', { ascending: true });

    if (error) throw error;
    setPincodes(data || []);
  };

  const getUniqueSlug = async ({ table, baseSlug, filters = [], excludeId = '' }) => {
    const seed = slugify(baseSlug);
    for (let i = 0; i < 100; i += 1) {
      const candidate = i === 0 ? seed : `${seed}-${i + 1}`;
      let query = supabase.from(table).select('id').eq('slug', candidate).limit(1);
      filters.forEach(([col, val]) => {
        query = query.eq(col, val);
      });
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return candidate;
    }
    return `${seed}-${Date.now().toString(36)}`;
  };

  const getUniqueDivisionKey = async ({ stateId, cityId, slug, excludeId = '' }) => {
    const base = `${stateId}::${cityId}::${slug}`;
    for (let i = 0; i < 100; i += 1) {
      const candidate = i === 0 ? base : `${stateId}::${cityId}::${slug}-${i + 1}`;
      let query = supabase.from('geo_divisions').select('id').eq('division_key', candidate).limit(1);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return candidate;
    }
    return `${stateId}::${cityId}::${slug}-${Date.now().toString(36)}`;
  };

  const syncDivisionPincodeCount = async (divisionId) => {
    if (!divisionId) return;
    const { count, error: countErr } = await supabase
      .from('geo_division_pincodes')
      .select('id', { count: 'exact', head: true })
      .eq('division_id', divisionId);
    if (countErr) throw countErr;

    const { error: updErr } = await supabase
      .from('geo_divisions')
      .update({
        pincode_count: Number(count || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', divisionId);
    if (updErr) throw updErr;
  };

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await fetchStates();
      } catch (error) {
        withToastError('Failed to load states', error);
      } finally {
        setLoading(false);
      }
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await fetchCities(selectedStateId);
      } catch (error) {
        withToastError('Failed to load cities', error);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStateId]);

  useEffect(() => {
    const run = async () => {
      try {
        await fetchDivisions(selectedCityId);
      } catch (error) {
        withToastError('Failed to load divisions', error);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCityId]);

  useEffect(() => {
    const run = async () => {
      try {
        await fetchDivisionPincodes(selectedDivisionId);
      } catch (error) {
        withToastError('Failed to load pincodes', error);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDivisionId]);

  const openStateDialog = (row = null) => {
    if (row?.id) setStateForm({ id: row.id, name: row.name || '' });
    else setStateForm({ id: '', name: '' });
    setShowStateDialog(true);
  };

  const openCityDialog = (row = null) => {
    if (row?.id) setCityForm({ id: row.id, name: row.name || '' });
    else setCityForm({ id: '', name: '' });
    setShowCityDialog(true);
  };

  const openDivisionDialog = (row = null) => {
    if (row?.id) {
      setDivisionForm({
        id: row.id,
        name: row.name || '',
        district_name: row.district_name || '',
        subdistrict_name: row.subdistrict_name || '',
      });
    } else {
      setDivisionForm({
        id: '',
        name: '',
        district_name: selectedCity?.name || '',
        subdistrict_name: '',
      });
    }
    setShowDivisionDialog(true);
  };

  const saveState = async () => {
    if (!stateForm.name.trim()) {
      toast({ title: 'State name required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const cleanName = stateForm.name.trim();
      const slug = await getUniqueSlug({
        table: 'states',
        baseSlug: cleanName,
        excludeId: stateForm.id,
      });

      if (stateForm.id) {
        const { error } = await supabase
          .from('states')
          .update({
            name: cleanName,
            slug,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stateForm.id);
        if (error) throw error;
        toast({ title: 'State updated' });
      } else {
        const { error } = await supabase.from('states').insert([
          {
            name: cleanName,
            slug,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        if (error) throw error;
        toast({ title: 'State added' });
      }

      setShowStateDialog(false);
      await fetchStates();
    } catch (error) {
      withToastError('Failed to save state', error);
    } finally {
      setSaving(false);
    }
  };

  const removeState = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Deactivate state "${row.name}" and related cities/divisions?`)) return;
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const { error: stateErr } = await supabase
        .from('states')
        .update({ is_active: false, updated_at: now })
        .eq('id', row.id);
      if (stateErr) throw stateErr;

      const { error: cityErr } = await supabase
        .from('cities')
        .update({ is_active: false, updated_at: now })
        .eq('state_id', row.id);
      if (cityErr) throw cityErr;

      const { error: divErr } = await supabase
        .from('geo_divisions')
        .update({ is_active: false, updated_at: now })
        .eq('state_id', row.id);
      if (divErr) throw divErr;

      toast({ title: 'State deactivated' });
      await fetchStates();
    } catch (error) {
      withToastError('Failed to deactivate state', error);
    } finally {
      setSaving(false);
    }
  };

  const saveCity = async () => {
    if (!selectedStateId) {
      toast({ title: 'Select a state first', variant: 'destructive' });
      return;
    }
    if (!cityForm.name.trim()) {
      toast({ title: 'City name required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const cleanName = cityForm.name.trim();
      const slug = await getUniqueSlug({
        table: 'cities',
        baseSlug: cleanName,
        filters: [['state_id', selectedStateId]],
        excludeId: cityForm.id,
      });

      if (cityForm.id) {
        const { error } = await supabase
          .from('cities')
          .update({
            name: cleanName,
            slug,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cityForm.id);
        if (error) throw error;
        toast({ title: 'City updated' });
      } else {
        const { error } = await supabase.from('cities').insert([
          {
            state_id: selectedStateId,
            name: cleanName,
            slug,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        if (error) throw error;
        toast({ title: 'City added' });
      }

      setShowCityDialog(false);
      await fetchCities(selectedStateId);
    } catch (error) {
      withToastError('Failed to save city', error);
    } finally {
      setSaving(false);
    }
  };

  const removeCity = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Deactivate city "${row.name}" and related divisions?`)) return;

    try {
      setSaving(true);
      const now = new Date().toISOString();
      const { error: cityErr } = await supabase
        .from('cities')
        .update({ is_active: false, updated_at: now })
        .eq('id', row.id);
      if (cityErr) throw cityErr;

      const { error: divErr } = await supabase
        .from('geo_divisions')
        .update({ is_active: false, updated_at: now })
        .eq('city_id', row.id);
      if (divErr) throw divErr;

      toast({ title: 'City deactivated' });
      await fetchCities(selectedStateId);
      await fetchDivisions(selectedCityId);
    } catch (error) {
      withToastError('Failed to deactivate city', error);
    } finally {
      setSaving(false);
    }
  };

  const saveDivision = async () => {
    if (!selectedStateId || !selectedCityId) {
      toast({ title: 'Select state and city first', variant: 'destructive' });
      return;
    }
    if (!divisionForm.name.trim()) {
      toast({ title: 'Division name required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const cleanName = divisionForm.name.trim();
      const slug = await getUniqueSlug({
        table: 'geo_divisions',
        baseSlug: cleanName,
        filters: [
          ['state_id', selectedStateId],
          ['city_id', selectedCityId],
        ],
        excludeId: divisionForm.id,
      });
      const divisionKey = await getUniqueDivisionKey({
        stateId: selectedStateId,
        cityId: selectedCityId,
        slug,
        excludeId: divisionForm.id,
      });

      if (divisionForm.id) {
        const { error } = await supabase
          .from('geo_divisions')
          .update({
            name: cleanName,
            slug,
            division_key: divisionKey,
            district_name: divisionForm.district_name?.trim() || null,
            subdistrict_name: divisionForm.subdistrict_name?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', divisionForm.id);
        if (error) throw error;
        toast({ title: 'Division updated' });
      } else {
        const { error } = await supabase.from('geo_divisions').insert([
          {
            state_id: selectedStateId,
            city_id: selectedCityId,
            division_key: divisionKey,
            name: cleanName,
            slug,
            district_name: divisionForm.district_name?.trim() || selectedCity?.name || null,
            subdistrict_name: divisionForm.subdistrict_name?.trim() || null,
            pincode_count: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        if (error) throw error;
        toast({ title: 'Division added' });
      }

      setShowDivisionDialog(false);
      await fetchDivisions(selectedCityId);
    } catch (error) {
      withToastError('Failed to save division', error);
    } finally {
      setSaving(false);
    }
  };

  const removeDivision = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Deactivate division "${row.name}"?`)) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('geo_divisions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      toast({ title: 'Division deactivated' });
      await fetchDivisions(selectedCityId);
    } catch (error) {
      withToastError('Failed to deactivate division', error);
    } finally {
      setSaving(false);
    }
  };

  const addPincodes = async () => {
    if (!selectedDivisionId) {
      toast({ title: 'Select a division first', variant: 'destructive' });
      return;
    }
    const values = splitPincodes(pincodeInput);
    if (!values.length) {
      toast({ title: 'Enter valid 6-digit pincode(s)', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const payload = values.map((pincode) => ({
        division_id: selectedDivisionId,
        pincode,
        source_district_name: selectedDivision?.district_name || null,
        source_subdistrict_name: selectedDivision?.subdistrict_name || null,
      }));

      const { error } = await supabase
        .from('geo_division_pincodes')
        .upsert(payload, { onConflict: 'division_id,pincode', ignoreDuplicates: true });
      if (error) throw error;

      await syncDivisionPincodeCount(selectedDivisionId);
      await fetchDivisions(selectedCityId);
      await fetchDivisionPincodes(selectedDivisionId);

      setPincodeInput('');
      toast({ title: `${values.length} pincode(s) mapped` });
    } catch (error) {
      withToastError('Failed to map pincode(s)', error);
    } finally {
      setSaving(false);
    }
  };

  const removePincode = async (row) => {
    if (!row?.id || !selectedDivisionId) return;
    if (!window.confirm(`Remove pincode ${row.pincode}?`)) return;

    try {
      setSaving(true);
      const { error } = await supabase.from('geo_division_pincodes').delete().eq('id', row.id);
      if (error) throw error;

      await syncDivisionPincodeCount(selectedDivisionId);
      await fetchDivisions(selectedCityId);
      await fetchDivisionPincodes(selectedDivisionId);
      toast({ title: 'Pincode removed' });
    } catch (error) {
      withToastError('Failed to remove pincode', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading location hierarchy...</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Location Hierarchy</h2>
          <p className="text-sm text-slate-600">
            Manage State - City - Division - Pincode mapping for territory allocation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                placeholder="Search state"
              />
              <Dialog open={showStateDialog} onOpenChange={setShowStateDialog}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline" onClick={() => openStateDialog()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{stateForm.id ? 'Edit State' : 'Add State'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>State Name</Label>
                      <Input
                        value={stateForm.name}
                        onChange={(e) => setStateForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Maharashtra"
                      />
                    </div>
                    <Button onClick={saveState} disabled={saving} className="w-full">
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="max-h-[360px] overflow-y-auto space-y-2">
              {filteredStates.map((state) => (
                <div
                  key={state.id}
                  className={`rounded border p-2 ${selectedStateId === state.id ? 'border-blue-500 bg-blue-50' : ''}`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedStateId(state.id)}
                  >
                    <div className="font-medium text-sm">{state.name}</div>
                    <div className="text-xs text-slate-500">{state.slug}</div>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openStateDialog(state)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeState(state)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {!filteredStates.length && (
                <div className="text-sm text-slate-500">No states found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Cities {selectedState ? <span className="text-xs text-slate-500">in {selectedState.name}</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Search city"
              />
              <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
                <DialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!selectedStateId}
                    onClick={() => openCityDialog()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{cityForm.id ? 'Edit City' : 'Add City'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>City Name</Label>
                      <Input
                        value={cityForm.name}
                        onChange={(e) => setCityForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Pune"
                      />
                    </div>
                    <Button onClick={saveCity} disabled={saving} className="w-full">
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="max-h-[360px] overflow-y-auto space-y-2">
              {filteredCities.map((city) => (
                <div
                  key={city.id}
                  className={`rounded border p-2 ${selectedCityId === city.id ? 'border-emerald-500 bg-emerald-50' : ''}`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedCityId(city.id)}
                  >
                    <div className="font-medium text-sm">{city.name}</div>
                    <div className="text-xs text-slate-500">{city.slug}</div>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openCityDialog(city)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeCity(city)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {!selectedStateId ? (
                <div className="text-sm text-slate-500">Select a state first.</div>
              ) : null}
              {selectedStateId && !filteredCities.length ? (
                <div className="text-sm text-slate-500">No cities found.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Divisions {selectedCity ? <span className="text-xs text-slate-500">in {selectedCity.name}</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                placeholder="Search division"
              />
              <Dialog open={showDivisionDialog} onOpenChange={setShowDivisionDialog}>
                <DialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!selectedCityId}
                    onClick={() => openDivisionDialog()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{divisionForm.id ? 'Edit Division' : 'Add Division'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Division Name</Label>
                      <Input
                        value={divisionForm.name}
                        onChange={(e) => setDivisionForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Pune Central Division"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>District</Label>
                      <Input
                        value={divisionForm.district_name}
                        onChange={(e) =>
                          setDivisionForm((prev) => ({ ...prev, district_name: e.target.value }))
                        }
                        placeholder="e.g. Pune"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Subdistrict</Label>
                      <Input
                        value={divisionForm.subdistrict_name}
                        onChange={(e) =>
                          setDivisionForm((prev) => ({ ...prev, subdistrict_name: e.target.value }))
                        }
                        placeholder="e.g. Haveli"
                      />
                    </div>
                    <Button onClick={saveDivision} disabled={saving} className="w-full">
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="max-h-[360px] overflow-y-auto space-y-2">
              {filteredDivisions.map((division) => (
                <div
                  key={division.id}
                  className={`rounded border p-2 ${selectedDivisionId === division.id ? 'border-purple-500 bg-purple-50' : ''}`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedDivisionId(division.id)}
                  >
                    <div className="font-medium text-sm">{division.name}</div>
                    <div className="text-xs text-slate-500">
                      {[division.district_name, division.subdistrict_name].filter(Boolean).join(' / ') || 'No district info'}
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline">{division.pincode_count || 0} pincodes</Badge>
                    </div>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openDivisionDialog(division)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeDivision(division)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {!selectedCityId ? (
                <div className="text-sm text-slate-500">Select a city first.</div>
              ) : null}
              {selectedCityId && !filteredDivisions.length ? (
                <div className="text-sm text-slate-500">No divisions found.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Pincode Mapping
            {selectedDivision ? (
              <span className="ml-2 text-xs text-slate-500">
                {selectedDivision.name} ({selectedCity?.name || 'City'} - {selectedState?.name || 'State'})
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedDivision ? (
            <div className="rounded border border-dashed p-6 text-center text-sm text-slate-500">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 opacity-60" />
              Select a division to manage pincodes.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Add pincode(s)</Label>
                  <Input
                    value={pincodeInput}
                    onChange={(e) => setPincodeInput(e.target.value)}
                    placeholder="Enter 6-digit pincodes. Use comma/space for multiple"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addPincodes} disabled={saving} className="w-full">
                    {saving ? 'Saving...' : 'Map Pincode'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Input
                  value={pincodeFilter}
                  onChange={(e) => setPincodeFilter(e.target.value)}
                  placeholder="Filter pincode"
                  className="max-w-xs"
                />
                <Badge variant="outline">{filteredPincodes.length} mapped</Badge>
              </div>

              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pincode</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Subdistrict</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPincodes.length ? (
                      filteredPincodes.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.pincode}</TableCell>
                          <TableCell>{row.source_district_name || '-'}</TableCell>
                          <TableCell>{row.source_subdistrict_name || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removePincode(row)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-slate-500 py-6">
                          No pincodes mapped yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationsFixed;
