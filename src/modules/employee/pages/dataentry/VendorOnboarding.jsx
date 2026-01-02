import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from '@/modules/vendor/services/vendorApi';

const VendorOnboarding = () => {
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    stateId: '',
    cityId: '',
    gstNumber: '',
    tempPassword: ''
  });

  // ---------------- INIT ----------------
  useEffect(() => {
    vendorApi.getStates().then(setStates).catch(console.error);
  }, []);

  const handleStateChange = async (stateId) => {
    setFormData(p => ({ ...p, stateId, cityId: '' }));
    const c = await vendorApi.getCities(stateId);
    setCities(c);
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const password =
        formData.tempPassword ||
        Math.random().toString(36).slice(-8) + 'Aa1!';

      // 1️⃣ CREATE AUTH USER
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: formData.email,
          password,
          options: {
            data: {
              role: 'VENDOR',
              full_name: formData.ownerName
            }
          }
        });

      if (authError) throw authError;
      const userId = authData.user.id;

      // Get state/city names (optional but API expects them)
      const stateName = states.find(s => s.id === formData.stateId)?.name;
      const cityName = cities.find(c => c.id === formData.cityId)?.name;

      // 2️⃣ REGISTER VENDOR (🔥 CORRECT API)
      await vendorApi.registerVendor({
        userId,
        companyName: formData.companyName,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        gstNumber: formData.gstNumber,
        stateId: formData.stateId,
        cityId: formData.cityId,
        stateName,
        cityName
      });

      // 3️⃣ FETCH FINAL VENDOR (for display)
      const vendor = await vendorApi.getVendorByUserId(userId);

      toast({
        title: 'Vendor Created ✅',
        description: `Vendor ID: ${vendor.vendor_id}`
      });

      // RESET
      setFormData({
        companyName: '',
        ownerName: '',
        email: '',
        phone: '',
        address: '',
        stateId: '',
        cityId: '',
        gstNumber: '',
        tempPassword: ''
      });

    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: err.message || 'Something went wrong',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="p-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Internal Vendor Onboarding</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  required
                  value={formData.companyName}
                  onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                />
              </div>

              <div>
                <Label>Owner Name</Label>
                <Input
                  required
                  value={formData.ownerName}
                  onChange={e => setFormData(p => ({ ...p, ownerName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div>
                <Label>Business Phone</Label>
                <Input
                  required
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>GST Number</Label>
              <Input
                value={formData.gstNumber}
                onChange={e => setFormData(p => ({ ...p, gstNumber: e.target.value }))}
              />
            </div>

            <div>
              <Label>Business Address</Label>
              <Input
                value={formData.address}
                onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Select value={formData.stateId} onValueChange={handleStateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>City</Label>
                <Select
                  value={formData.cityId}
                  onValueChange={v => setFormData(p => ({ ...p, cityId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Temporary Password (optional)</Label>
              <Input
                value={formData.tempPassword}
                onChange={e => setFormData(p => ({ ...p, tempPassword: e.target.value }))}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Creating Vendor...' : 'Create Vendor'}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorOnboarding;
