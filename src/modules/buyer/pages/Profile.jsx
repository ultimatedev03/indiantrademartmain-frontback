
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Upload, Save, User, Building, MapPin } from 'lucide-react';

const BuyerProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    company_type: '',
    industry: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    avatar_url: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Fetch from buyers table
      const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          company_name: data.company_name || '',
          company_type: data.company_type || '',
          industry: data.industry || '',
          gst_number: data.gst_number || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          avatar_url: data.avatar_url || ''
        });
      } else {
        // Initialize with user metadata if no buyer profile exists
        setFormData(prev => ({
          ...prev,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `buyer-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      // Save immediately
      await saveData({ ...formData, avatar_url: publicUrl });
      toast({ title: "Success", description: "Avatar updated" });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveData = async (dataToSave) => {
    // Upsert into buyers table
    const { error } = await supabase
      .from('buyers')
      .upsert({
        user_id: user.id,
        ...dataToSave,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) throw error;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await saveData(formData);
      toast({ title: "Profile Saved", description: "Your details have been updated." });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: "Save Failed", description: "Could not save profile changes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-gray-500">Manage your account details</p>
        </div>
        <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                  <AvatarImage src={formData.avatar_url} />
                  <AvatarFallback className="text-3xl bg-blue-100 text-blue-700">
                    {formData.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>
              <h2 className="text-xl font-semibold">{formData.full_name || 'User'}</h2>
              <p className="text-sm text-gray-500">{formData.email}</p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-blue-600"/> Personal Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Full Name</Label><Input name="full_name" value={formData.full_name} onChange={handleInputChange} /></div>
                <div><Label>Phone</Label><Input name="phone" value={formData.phone} onChange={handleInputChange} /></div>
                <div className="md:col-span-2"><Label>Email</Label><Input value={formData.email} disabled className="bg-gray-50" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-blue-600"/> Company Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Company Name</Label><Input name="company_name" value={formData.company_name} onChange={handleInputChange} /></div>
                <div>
                   <Label>Type</Label>
                   <select name="company_type" value={formData.company_type} onChange={handleInputChange} className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm">
                      <option value="">Select Type</option>
                      <option value="Private Limited">Private Limited</option>
                      <option value="Proprietorship">Proprietorship</option>
                   </select>
                </div>
                <div><Label>Industry</Label><Input name="industry" value={formData.industry} onChange={handleInputChange} /></div>
                <div><Label>GST Number</Label><Input name="gst_number" value={formData.gst_number} onChange={handleInputChange} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-600"/> Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div><Label>Street Address</Label><Input name="address" value={formData.address} onChange={handleInputChange} /></div>
               <div className="grid grid-cols-3 gap-4">
                  <div><Label>City</Label><Input name="city" value={formData.city} onChange={handleInputChange} /></div>
                  <div><Label>State</Label><Input name="state" value={formData.state} onChange={handleInputChange} /></div>
                  <div><Label>Pincode</Label><Input name="pincode" value={formData.pincode} onChange={handleInputChange} /></div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BuyerProfile;
