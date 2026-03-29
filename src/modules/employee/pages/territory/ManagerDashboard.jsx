import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { territoryApi } from '@/modules/employee/services/territoryApi';
import { useEmployeeAuth } from '@/modules/employee/context/EmployeeAuthContext';
import { locationService } from '@/shared/services/locationService';

const ALL_STATES_VALUE = 'all';
const ALL_CITIES_VALUE = 'all';
const normalizeId = (value) => String(value || '').trim();

const ManagerDashboard = () => {
  const { user } = useEmployeeAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [salesUsers, setSalesUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [selectedSalesUser, setSelectedSalesUser] = useState('');
  const [selectedDivisionIds, setSelectedDivisionIds] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState(ALL_STATES_VALUE);
  const [selectedCityId, setSelectedCityId] = useState(ALL_CITIES_VALUE);

  const filteredDivisions = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    return (divisions || []).filter((d) => {
      if (selectedStateId !== ALL_STATES_VALUE && normalizeId(d?.state_id) !== selectedStateId) return false;
      if (selectedCityId !== ALL_CITIES_VALUE && normalizeId(d?.city_id) !== selectedCityId) return false;
      if (!term) return true;
      return [d?.name, d?.city?.name, d?.state?.name, d?.district_name, d?.subdistrict_name, d?.pincode_count]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term));
    });
  }, [divisions, search, selectedStateId, selectedCityId]);

  const stateOptions = useMemo(() => {
    const divisionStateIds = new Set((divisions || []).map((d) => normalizeId(d?.state_id)).filter(Boolean));
    const options = (states || [])
      .filter((state) => divisionStateIds.has(normalizeId(state?.id)))
      .map((state) => ({
        id: normalizeId(state?.id),
        name: state?.name || 'State N/A',
      }));

    if (options.length === divisionStateIds.size) {
      return options.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    const seen = new Set(options.map((state) => state.id));
    (divisions || []).forEach((d) => {
      const stateId = normalizeId(d?.state_id);
      if (!stateId || seen.has(stateId)) return;
      seen.add(stateId);
      options.push({
        id: stateId,
        name: d?.state?.name || 'State N/A',
      });
    });

    return options.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [divisions, states]);

  const cityOptions = useMemo(() => {
    return (cities || [])
      .map((city) => ({
        id: normalizeId(city?.id),
        name: city?.name || 'City N/A',
      }))
      .filter((city) => city.id)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [cities]);

  const loadBase = async () => {
    try {
      setLoading(true);
      const [salesRows, divisionRows, allocationRows] = await Promise.all([
        territoryApi.getEmployees('SALES'),
        territoryApi.getDivisions({ include_pincodes: 'true' }),
        territoryApi.getManagerSalesAllocations({ active: 'true' }),
      ]);

      setSalesUsers(salesRows || []);
      setDivisions(divisionRows || []);
      setAllocations(allocationRows || []);
    } catch (error) {
      toast({
        title: 'Failed to load manager data',
        description: error?.message || 'Unable to load manager territory controls',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStates = async () => {
      try {
        setStatesLoading(true);
        const rows = await locationService.getStates();
        if (mounted) {
          setStates(rows || []);
        }
      } catch (error) {
        if (mounted) {
          toast({
            title: 'Failed to load states',
            description: error?.message || 'Unable to load available states',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) {
          setStatesLoading(false);
        }
      }
    };

    loadStates();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSalesUser) {
      setSelectedDivisionIds([]);
      return;
    }
    const assigned = (allocations || [])
      .filter((a) => a.sales_user_id === selectedSalesUser && a.allocation_status === 'ACTIVE')
      .map((a) => a.division_id)
      .filter(Boolean);
    setSelectedDivisionIds(assigned);
  }, [allocations, selectedSalesUser]);

  useEffect(() => {
    setSelectedCityId(ALL_CITIES_VALUE);
  }, [selectedStateId]);

  useEffect(() => {
    let mounted = true;

    const loadCities = async () => {
      if (selectedStateId === ALL_STATES_VALUE) {
        setCitiesLoading(false);
        setCities([]);
        return;
      }

      try {
        setCitiesLoading(true);
        const rows = await locationService.getCities(selectedStateId);
        if (mounted) {
          setCities(rows || []);
        }
      } catch (error) {
        if (mounted) {
          setCities([]);
          toast({
            title: 'Failed to load cities',
            description: error?.message || 'Unable to load cities for the selected state',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) {
          setCitiesLoading(false);
        }
      }
    };

    loadCities();
    return () => {
      mounted = false;
    };
  }, [selectedStateId]);

  const toggleDivision = (divisionId, checked) => {
    setSelectedDivisionIds((prev) => {
      const set = new Set(prev || []);
      if (checked) set.add(divisionId);
      else set.delete(divisionId);
      return [...set];
    });
  };

  const saveAllocations = async () => {
    if (!selectedSalesUser) {
      toast({ title: 'Select salesperson first', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await territoryApi.saveManagerSalesAllocations({
        manager_user_id: user?.user_id || user?.id || '',
        sales_user_id: selectedSalesUser,
        division_ids: selectedDivisionIds,
        mode: 'REPLACE',
      });
      toast({ title: 'Sales allocation saved' });
      const rows = await territoryApi.getManagerSalesAllocations({ active: 'true' });
      setAllocations(rows || []);
    } catch (error) {
      toast({
        title: 'Failed to save allocations',
        description: error?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const salesStats = useMemo(() => {
    const grouped = new Map();
    (allocations || []).forEach((a) => {
      if (a.allocation_status !== 'ACTIVE') return;
      const key = a.sales_user_id;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return grouped;
  }, [allocations]);

  const isStateScoped = selectedStateId !== ALL_STATES_VALUE;
  const citySelectDisabled = !isStateScoped || citiesLoading;

  if (loading) {
    return (
      <div className="h-64 grid place-items-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manager Territory Dashboard</h1>
          <p className="text-sm text-slate-600">Allocate and rebalance divisions among sales team members.</p>
        </div>
        <Button variant="outline" onClick={loadBase}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Divisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{divisions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(allocations || []).filter((a) => a.allocation_status === 'ACTIVE').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedSalesUser} onValueChange={setSelectedSalesUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select salesperson" />
              </SelectTrigger>
              <SelectContent>
                {(salesUsers || []).map((sales) => (
                  <SelectItem key={sales.user_id} value={sales.user_id}>
                    {sales.full_name || sales.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStateId} onValueChange={setSelectedStateId} disabled={statesLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL_STATES_VALUE}>All states</SelectItem>
                {stateOptions.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedCityId} onValueChange={setSelectedCityId} disabled={citySelectDisabled}>
              <SelectTrigger>
                <SelectValue placeholder={isStateScoped ? 'Filter by city' : 'Select a state first'} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL_CITIES_VALUE}>All cities</SelectItem>
                {cityOptions.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Label htmlFor="manager-division-search">Search divisions</Label>
              <Input
                id="manager-division-search"
                type="search"
                name="manager-division-search"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search division, city, state or pincode"
              />
            </div>
          </div>

          {!selectedSalesUser ? (
            <div className="text-sm text-slate-500">Choose a salesperson to allocate divisions.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto border rounded-lg p-3 space-y-2">
              {filteredDivisions.length ? (
                filteredDivisions.map((division) => {
                  const checked = selectedDivisionIds.includes(division.id);
                  const pincodeRows = Array.isArray(division.division_pincodes) ? division.division_pincodes : [];
                  const pincodePreview = pincodeRows
                    .map((x) => String(x?.pincode || '').trim())
                    .filter(Boolean)
                    .slice(0, 3);
                  const remainingPincodes = Math.max(0, pincodeRows.length - pincodePreview.length);
                  return (
                    <label key={division.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
                      <Checkbox checked={checked} onCheckedChange={(v) => toggleDivision(division.id, Boolean(v))} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{division.name}</div>
                        <div className="text-xs text-slate-500">
                          {division.city?.name || 'City N/A'} • {division.state?.name || 'State N/A'}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Badge variant="outline">{division.pincode_count || 0} pincodes</Badge>
                          {(division.district_name || division.subdistrict_name) ? (
                            <span>
                              {[division.district_name, division.subdistrict_name].filter(Boolean).join(' / ')}
                            </span>
                          ) : null}
                        </div>
                        {pincodePreview.length ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            Pincodes: {pincodePreview.join(', ')}{remainingPincodes ? ` +${remainingPincodes}` : ''}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="rounded border border-dashed px-3 py-6 text-center text-sm text-slate-500">
                  No divisions match the current filters.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveAllocations} disabled={saving || !selectedSalesUser}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Allocation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(salesUsers || []).map((sales) => (
            <div key={sales.user_id} className="flex items-center justify-between rounded border p-2">
              <div className="text-sm">{sales.full_name || sales.email}</div>
              <Badge variant="outline">{salesStats.get(sales.user_id) || 0} divisions</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerDashboard;
