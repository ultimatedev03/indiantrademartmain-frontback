import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { territoryApi } from '@/modules/employee/services/territoryApi';

const VpDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [managers, setManagers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const [selectedManager, setSelectedManager] = useState('');
  const [selectedDivisionIds, setSelectedDivisionIds] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState('all');
  const [selectedCityId, setSelectedCityId] = useState('all');

  const filteredDivisions = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    return (divisions || []).filter((d) => {
      if (selectedStateId !== 'all' && d?.state_id !== selectedStateId) return false;
      if (selectedCityId !== 'all' && d?.city_id !== selectedCityId) return false;
      if (!term) return true;
      return [d?.name, d?.city?.name, d?.state?.name, d?.district_name, d?.subdistrict_name, d?.pincode_count]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term));
    });
  }, [divisions, search, selectedStateId, selectedCityId]);

  const stateOptions = useMemo(() => {
    const map = new Map();
    (divisions || []).forEach((d) => {
      if (!d?.state_id) return;
      if (!map.has(d.state_id)) {
        map.set(d.state_id, {
          id: d.state_id,
          name: d?.state?.name || 'State N/A',
        });
      }
    });
    return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [divisions]);

  const cityOptions = useMemo(() => {
    const map = new Map();
    (divisions || []).forEach((d) => {
      if (!d?.city_id) return;
      if (selectedStateId !== 'all' && d?.state_id !== selectedStateId) return;
      if (!map.has(d.city_id)) {
        map.set(d.city_id, {
          id: d.city_id,
          name: d?.city?.name || 'City N/A',
        });
      }
    });
    return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [divisions, selectedStateId]);

  const managerById = useMemo(() => {
    const map = new Map();
    (managers || []).forEach((m) => map.set(m.user_id, m));
    return map;
  }, [managers]);

  const loadBase = async () => {
    try {
      setLoading(true);
      const [managerRows, divisionRows, allocationRows] = await Promise.all([
        territoryApi.getEmployees('MANAGER'),
        territoryApi.getDivisions({ include_pincodes: 'true' }),
        territoryApi.getVpManagerAllocations({ active: 'true' }),
      ]);
      setManagers(managerRows || []);
      setDivisions(divisionRows || []);
      setAllocations(allocationRows || []);
    } catch (error) {
      toast({
        title: 'Failed to load territory data',
        description: error?.message || 'Unable to load VP territory controls',
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
    if (!selectedManager) {
      setSelectedDivisionIds([]);
      return;
    }

    const assigned = (allocations || [])
      .filter((a) => a.manager_user_id === selectedManager && a.allocation_status === 'ACTIVE')
      .map((a) => a.division_id)
      .filter(Boolean);
    setSelectedDivisionIds(assigned);
  }, [allocations, selectedManager]);

  useEffect(() => {
    setSelectedCityId('all');
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
    if (!selectedManager) {
      toast({ title: 'Select manager first', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await territoryApi.saveVpManagerAllocations({
        manager_user_id: selectedManager,
        division_ids: selectedDivisionIds,
        mode: 'REPLACE',
      });
      toast({ title: 'Manager allocation saved' });
      const rows = await territoryApi.getVpManagerAllocations({ active: 'true' });
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

  const managerStats = useMemo(() => {
    const grouped = new Map();
    (allocations || []).forEach((a) => {
      if (a.allocation_status !== 'ACTIVE') return;
      const key = a.manager_user_id;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return grouped;
  }, [allocations]);

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
          <h1 className="text-2xl font-bold text-slate-900">VP Territory Dashboard</h1>
          <p className="text-sm text-slate-600">Allocate city divisions to managers without changing existing sales flow.</p>
        </div>
        <Button variant="outline" onClick={loadBase}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Managers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Divisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{divisions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(allocations || []).filter((a) => a.allocation_status === 'ACTIVE').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manager Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                {(managers || []).map((manager) => (
                  <SelectItem key={manager.user_id} value={manager.user_id}>
                    {manager.full_name || manager.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStateId} onValueChange={setSelectedStateId}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {stateOptions.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {cityOptions.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search division / city / state / pincode"
            />
          </div>

          {!selectedManager ? (
            <div className="text-sm text-slate-500">Choose a manager to allocate divisions.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto border rounded-lg p-3 space-y-2">
              {filteredDivisions.map((division) => {
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
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveAllocations} disabled={saving || !selectedManager}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Allocation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manager Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(managers || []).map((manager) => (
            <div key={manager.user_id} className="flex items-center justify-between rounded border p-2">
              <div className="text-sm">{manager.full_name || manager.email}</div>
              <Badge variant="outline">{managerStats.get(manager.user_id) || 0} divisions</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default VpDashboard;
