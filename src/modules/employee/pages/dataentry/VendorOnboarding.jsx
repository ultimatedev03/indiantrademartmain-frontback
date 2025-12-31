
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { dataEntryApi } from '@/modules/employee/services/dataEntryApi';

const VendorOnboarding = () => {
  const [loading, setLoading] = useState(false);
  
  // Hierarchy Data
  const [headCategories, setHeadCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    ownerPhone: '',
    email: '',
    phone: '',
    address: '',
    stateId: '',
    cityId: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    gstNumber: '',
    headCatId: '',
    subCatId: '',
    tempPassword: ''
  });

  useEffect(() => {
    const init = async () => {
       const h = await dataEntryApi.getHeadCategories();
       setHeadCategories(h);
       const s = await dataEntryApi.getStates();
       setStates(s);
    };
    init();
  }, []);

  const handleHeadChange = async (val) => {
    setFormData(p => ({ ...p, headCatId: val, subCatId: '' }));
    const subs = await dataEntryApi.getSubCategories(val);
    setSubCategories(subs);
  };

  const handleStateChange = async (val) => {
    setFormData(p => ({ ...p, stateId: val, cityId: '' }));
    const c = await dataEntryApi.getCitiesByState(val);
    setCities(c);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { email, tempPassword, ownerName } = formData;
      const pass = tempPassword || Math.random().toString(36).slice(-8) + "Aa1!";

      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { role: 'VENDOR', full_name: ownerName } }
      });

      if (authError) throw authError;

      // 2. Create Vendor using dataEntryApi
      const vendor = await dataEntryApi.createVendor({
        company_name: formData.companyName,
        owner_name: formData.ownerName,
        owner_phone: formData.ownerPhone,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        state_id: formData.stateId,
        city_id: formData.cityId,
        bank_name: formData.bankName,
        account_number: formData.accountNumber,
        ifsc_code: formData.ifscCode,
        gst_number: formData.gstNumber,
        temp_password: pass
      });

      toast({ 
        title: "Success", 
        description: `Vendor "${formData.companyName}" onboarded with ID: ${vendor.vendor_id}` 
      });
      
      // Reset form
      setFormData({
        companyName: '', ownerName: '', ownerPhone: '', email: '', phone: '',
        address: '', stateId: '', cityId: '', bankName: '', accountNumber: '',
        ifscCode: '', gstNumber: '', headCatId: '', subCatId: '', tempPassword: ''
      });

    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Internal Vendor Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Company Name</Label>
                 <Input value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} required />
               </div>
               <div>
                 <Label>Owner Name</Label>
                 <Input value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} required />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Email</Label>
                 <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
               </div>
               <div>
                 <Label>Business Phone</Label>
                 <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Owner Phone</Label>
                 <Input value={formData.ownerPhone} onChange={e => setFormData({...formData, ownerPhone: e.target.value})} />
               </div>
               <div>
                 <Label>GST Number</Label>
                 <Input value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} />
               </div>
             </div>

             <div className="grid grid-cols-1 gap-4">
               <div>
                 <Label>Business Address</Label>
                 <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full address" />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>State</Label>
                 <Select onValueChange={handleStateChange} value={formData.stateId}>
                   <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                   <SelectContent>
                     {states.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Label>City</Label>
                 <Select onValueChange={v => setFormData({...formData, cityId: v})} value={formData.cityId}>
                   <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                   <SelectContent>
                     {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             </div>

             <div className="grid grid-cols-3 gap-4">
               <div>
                 <Label>Bank Name</Label>
                 <Input value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
               </div>
               <div>
                 <Label>Account Number</Label>
                 <Input value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} />
               </div>
               <div>
                 <Label>IFSC Code</Label>
                 <Input value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})} />
               </div>
             </div>

             <div>
               <Label>Temporary Password (Optional)</Label>
               <Input value={formData.tempPassword} onChange={e => setFormData({...formData, tempPassword: e.target.value})} placeholder="Auto-generated if empty" />
             </div>

             <Button type="submit" disabled={loading}>
               {loading ? "Creating..." : "Create Vendor Account"}
             </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorOnboarding;
