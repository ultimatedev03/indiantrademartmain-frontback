// ✅ File: src/modules/vendor/pages/Profile.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import PreferencesSection from '@/modules/vendor/components/PreferencesSection';
import SubscriptionBadge from '@/modules/vendor/components/SubscriptionBadge';
import {
  Loader2, Save, Camera, Pencil, MapPin, Phone, Mail,
  Plus, Trash2, Check, ExternalLink, FileText
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const Profile = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = searchParams.get("tab") || "primary";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({});
  const [draft, setDraft] = useState({});
  const [editingSection, setEditingSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({}); // { profile_image: boolean, banner_image: boolean }

  const [banks, setBanks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // ✅ keep tab in sync with URL ?tab=
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam);
  }, [searchParams, activeTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, bankList, docList, sub] = await Promise.all([
        vendorApi.auth.me(),
        vendorApi.banking.list(),
        vendorApi.documents.list(),
        vendorApi.subscriptions.getCurrent()
      ]);

      const p = prof || {};
      
      // Normalize the profile data to ensure both snake_case and camelCase keys exist
      const normalizedProfile = {
        ...p,
        companyName: p.companyName || p.company_name,
        ownerName: p.ownerName || p.owner_name,
        gstNumber: p.gstNumber || p.gst_number,
        panNumber: p.panNumber || p.pan_number,
        aadharNumber: p.aadharNumber || p.aadhar_number,
        secondaryEmail: p.secondaryEmail || p.secondary_email,
        secondaryPhone: p.secondaryPhone || p.secondary_phone,
        landlineNumber: p.landlineNumber || p.landline_number,
        websiteUrl: p.websiteUrl || p.website_url,
        primaryBusinessType: p.primaryBusinessType || p.primary_business_type,
        annualTurnover: p.annualTurnover || p.annual_turnover,
        cinNumber: p.cinNumber || p.cin_number,
        llpinNumber: p.llpinNumber || p.llpin_number,
        iecCode: p.iecCode || p.iec_code,
        yearOfEstablishment: p.yearOfEstablishment ?? p.year_of_establishment,
        ownerDesignation: p.ownerDesignation || p.owner_designation,
      };
      
      setProfile(normalizedProfile);
      setDraft(normalizedProfile);
      setBanks(bankList || []);
      setDocuments(docList || []);
      setSubscription(sub || null);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error loading profile",
        description: e?.message || "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ✅ FIXED: auth-only fields removed, confirmed_at removed
  const handleSave = async () => {
    setSaving(true);
    try {
      // ✅ remove auth-only fields if present (VERY IMPORTANT)
      // eslint-disable-next-line no-unused-vars
      const {
        app_metadata,
        user_metadata,
        aud,
        id,
        created_at,

        confirmed_at,
        email_confirmed_at,
        last_sign_in_at,
        phone_confirmed_at,
        identities,
        factors,
        role,

        ...cleanDraft
      } = draft;

      await vendorApi.auth.updateProfile(cleanDraft);

      setProfile(prev => ({ ...prev, ...cleanDraft }));
      setDraft(prev => ({ ...prev, ...cleanDraft }));
      setEditingSection(null);

      window.dispatchEvent(new Event('vendor_profile_updated'));

      toast({
        title: "Profile Updated Successfully",
        className: "bg-green-50 text-green-900 border-green-200"
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Update Failed",
        description: e?.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [field]: true }));
    try {
      // ✅ If your vendorApi expects bucket name change here
      const url = await vendorApi.auth.uploadImage(file, 'avatars');

      const updates = { [field]: url };
      await vendorApi.auth.updateProfile(updates);

      setProfile(prev => ({ ...prev, ...updates }));
      setDraft(prev => ({ ...prev, ...updates }));

      window.dispatchEvent(new Event('vendor_profile_updated'));
      toast({ title: "Image Uploaded" });
    } catch (e2) {
      console.error('Image upload error:', e2);
      toast({
        title: "Upload Failed",
        description: e2?.message || "Please check your connection and try again",
        variant: "destructive"
      });
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
      try { e.target.value = ""; } catch (_) {}
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  const companyTitle = profile.companyName || profile.company_name || 'My Company';
  const ownerTitle = profile.ownerName || profile.owner_name || '';

  return (
    <div className="bg-slate-50 min-h-screen pb-12 font-sans text-slate-900">
      <style>{`
        html { overflow-y: auto; }
        body { overflow-y: scroll; scrollbar-gutter: stable; }
        ::-webkit-scrollbar { width: 0 !important; }
        ::-webkit-scrollbar-track { background: transparent !important; }
        ::-webkit-scrollbar-thumb { background: transparent !important; }
        * { scrollbar-width: none !important; }
      `}</style>
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* === LEFT SIDEBAR === */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-t-4 border-t-[#003D82] shadow-sm sticky top-6">
            <div className="p-6 text-center border-b border-slate-100">
              <div className="relative inline-block group">
                <div className="w-24 h-24 mx-auto bg-white rounded-full border-4 border-slate-100 shadow-sm overflow-hidden flex items-center justify-center">
                  {profile.profile_image ? (
                    <img src={profile.profile_image} className="w-full h-full object-cover" alt="Logo" />
                  ) : (
                    <span className="text-3xl font-bold text-slate-300">{(companyTitle?.[0] || 'M')}</span>
                  )}
                </div>

                <label className="absolute bottom-0 right-0 p-1.5 bg-[#003D82] rounded-full cursor-pointer hover:bg-blue-800 transition-colors shadow-sm">
                  {uploading.profile_image ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'profile_image')}
                    disabled={!!uploading.profile_image}
                  />
                </label>
              </div>

              <div className="mt-4">
                <h2 className="text-lg font-bold text-slate-900 leading-tight flex items-center justify-center gap-2">
                  {companyTitle}
                  <Pencil
                    className="w-3 h-3 text-slate-400 cursor-pointer hover:text-[#003D82]"
                    onClick={() => { setActiveTab('primary'); setEditingSection('primary'); navigate(`?tab=primary`, { replace: true }); }}
                  />
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">{ownerTitle}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <span className="text-slate-600 leading-relaxed">
                  {profile.address || 'Add Address'} <br />
                  {profile.city || 'City'}, {profile.state || 'State'} - {profile.pincode || 'Pincode'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-600">{profile.phone || 'Add Phone'}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-600 truncate">{profile.email || '—'}</span>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Your Vendor ID</p>
                <p className="text-sm font-bold text-blue-900">
                  {profile.vendorId || profile.vendor_id || 'Generating...'}
                </p>
              </div>
            </div>
          </Card>

          {/* Subscription Status Card */}
          <Card className="shadow-sm">
            <div className="p-5">
              <p className="text-xs text-slate-500 font-semibold mb-3">Subscription Status</p>
              <SubscriptionBadge subscription={subscription} loading={subscriptionLoading} />
            </div>
          </Card>
        </div>

        {/* === MAIN CONTENT === */}
        <div className="lg:col-span-9">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              navigate(`?tab=${val}`, { replace: true });
            }}
            className="w-full"
          >
            <div className="bg-white rounded-t-lg border-b border-slate-200 shadow-sm">
              <TabsList className="w-full justify-start bg-transparent h-auto p-0 overflow-x-auto scrollbar-hide">
                {[
                  { label: 'Primary Details', value: 'primary' },
                  { label: 'Additional Details', value: 'additional' },
                  { label: 'Bank Details', value: 'bank' },
                  { label: 'Business Preferences', value: 'preferences' },
                  { label: 'KYC Documents', value: 'kyc' },
                ].map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#003D82] data-[state=active]:text-[#003D82] rounded-none px-4 py-3.5 h-auto text-slate-600 font-medium whitespace-nowrap text-sm"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 shadow-sm min-h-[500px]">
              {/* 1. PRIMARY DETAILS */}
              <TabsContent value="primary" className="m-0 p-6">
                <SectionHeader
                  title="Primary Details"
                  editing={editingSection === 'primary'}
                  onEdit={() => setEditingSection('primary')}
                  onCancel={() => { setDraft(profile); setEditingSection(null); }}
                  onSave={handleSave}
                  saving={saving}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Company Name</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      value={draft.companyName || draft.company_name || ''}
                      onChange={e => setDraft({ ...draft, companyName: e.target.value, company_name: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Owner Name</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      value={draft.ownerName || draft.owner_name || ''}
                      onChange={e => setDraft({ ...draft, ownerName: e.target.value, owner_name: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Email (Read-only)</Label>
                    <Input disabled value={draft.email || ''} className="h-9 bg-slate-50" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Mobile</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      value={draft.phone || ''}
                      onChange={e => setDraft({ ...draft, phone: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  {/* ✅ Secondary Email */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Secondary Email</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      placeholder="secondary@example.com"
                      value={draft.secondaryEmail || draft.secondary_email || ''}
                      onChange={e => setDraft({ ...draft, secondaryEmail: e.target.value, secondary_email: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  {/* ✅ Secondary Phone */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Second Phone Number</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      placeholder="Alternate mobile"
                      value={draft.secondaryPhone || draft.secondary_phone || ''}
                      onChange={e => setDraft({ ...draft, secondaryPhone: e.target.value, secondary_phone: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  {/* ✅ Landline */}
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-slate-500">Landline Number</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      placeholder="Landline (optional)"
                      value={draft.landlineNumber || draft.landline_number || ''}
                      onChange={e => setDraft({ ...draft, landlineNumber: e.target.value, landline_number: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-full">
                    <Label className="text-xs text-slate-500">Address</Label>
                    <Input
                      disabled={editingSection !== 'primary'}
                      value={draft.address || ''}
                      onChange={e => setDraft({ ...draft, address: e.target.value })}
                      className="h-9 mb-4"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        placeholder="City"
                        disabled={editingSection !== 'primary'}
                        value={draft.city || ''}
                        onChange={e => setDraft({ ...draft, city: e.target.value })}
                        className="h-9"
                      />
                      <Input
                        placeholder="State"
                        disabled={editingSection !== 'primary'}
                        value={draft.state || ''}
                        onChange={e => setDraft({ ...draft, state: e.target.value })}
                        className="h-9"
                      />
                      <Input
                        placeholder="Pincode"
                        disabled={editingSection !== 'primary'}
                        value={draft.pincode || ''}
                        onChange={e => setDraft({ ...draft, pincode: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 2. ADDITIONAL DETAILS */}
              <TabsContent value="additional" className="m-0 p-6">
                <SectionHeader
                  title="Business & Statutory Details"
                  editing={editingSection === 'additional'}
                  onEdit={() => setEditingSection('additional')}
                  onCancel={() => { setDraft(profile); setEditingSection(null); }}
                  onSave={handleSave}
                  saving={saving}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">GST Number</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      value={draft.gstNumber || draft.gst_number || ''}
                      onChange={e => setDraft({ ...draft, gstNumber: e.target.value, gst_number: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">PAN Number</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      value={draft.panNumber || draft.pan_number || ''}
                      onChange={e => setDraft({ ...draft, panNumber: e.target.value, pan_number: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Aadhar Number</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      value={draft.aadharNumber || draft.aadhar_number || ''}
                      onChange={e => setDraft({ ...draft, aadharNumber: e.target.value, aadhar_number: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Website URL</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      placeholder="https://example.com"
                      value={draft.websiteUrl || draft.website_url || ''}
                      onChange={e => setDraft({ ...draft, websiteUrl: e.target.value, website_url: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Business Type</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      value={draft.primaryBusinessType || draft.primary_business_type || ''}
                      onChange={e => setDraft({ ...draft, primaryBusinessType: e.target.value, primary_business_type: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Annual Turnover</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      value={draft.annualTurnover || draft.annual_turnover || ''}
                      onChange={e => setDraft({ ...draft, annualTurnover: e.target.value, annual_turnover: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">CIN/LLPIN Number</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      placeholder="CIN (if company)"
                      value={draft.cinNumber || draft.cin_number || ''}
                      onChange={e => setDraft({ ...draft, cinNumber: e.target.value, cin_number: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">TAN Number</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      placeholder="TAN Number"
                      value={draft.tanNumber || draft.tan_number || ''}
                      onChange={e => setDraft({ ...draft, tanNumber: e.target.value, tan_number: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Import Export Code (IEC)</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      placeholder="IEC Code"
                      value={draft.iecCode || draft.iec_code || ''}
                      onChange={e => setDraft({ ...draft, iecCode: e.target.value, iec_code: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Year of Establishment</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      type="number"
                      placeholder="e.g. 2015"
                      value={draft.yearOfEstablishment ?? draft.year_of_establishment ?? ''}
                      onChange={e => setDraft({
                        ...draft,
                        yearOfEstablishment: e.target.value === '' ? null : Number(e.target.value),
                        year_of_establishment: e.target.value === '' ? null : Number(e.target.value),
                      })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-slate-500">Designation of Owner</Label>
                    <Input
                      disabled={editingSection !== 'additional'}
                      placeholder="e.g. Proprietor / Director / CEO"
                      value={draft.ownerDesignation || draft.owner_designation || ''}
                      onChange={e => setDraft({ ...draft, ownerDesignation: e.target.value, owner_designation: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 3. BANK DETAILS */}
              <TabsContent value="bank" className="m-0 p-6">
                <BankingSection banks={banks} onRefresh={loadData} />
              </TabsContent>

              {/* 4. BUSINESS PREFERENCES */}
              <TabsContent value="preferences" className="m-0 p-6">
                <PreferencesSection />
              </TabsContent>

              {/* 5. KYC DOCUMENTS */}
              <TabsContent value="kyc" className="m-0 p-6">
                <DocumentsSection
                  documents={documents}
                  onRefresh={loadData}
                  kycStatus={profile.kyc_status}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

// ---------------- SUB COMPONENTS ----------------

const SectionHeader = ({ title, editing, onEdit, onCancel, onSave, saving }) => (
  <div className="flex justify-between items-center mb-4 border-b pb-2">
    <h3 className="font-bold text-lg text-slate-900">{title}</h3>
    <div className="flex gap-2">
      {editing ? (
        <>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" className="bg-[#003D82]" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            Save
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
          onClick={onEdit}
        >
          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      )}
    </div>
  </div>
);

const SectionHeaderWithActions = ({ title, onAdd }) => (
  <div className="flex justify-between items-center mb-4 border-b pb-2">
    <h3 className="font-bold text-lg text-slate-900">{title}</h3>
    {onAdd && (
      <Button
        size="sm"
        variant="ghost"
        className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
        onClick={onAdd}
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Add New
      </Button>
    )}
  </div>
);

const BankingSection = ({ banks, onRefresh }) => {
  // Generate a temporary client-side ID (will be replaced with UUID on save)
  const generateTempId = () => `temp-${Math.random().toString(36).substr(2, 9)}`;
  const [newBanks, setNewBanks] = useState(banks.length > 0 ? banks : [{ id: generateTempId() }]);
  const [adding, setAdding] = useState(false);

  const handleUpdateBank = (index, field, value) => {
    const updated = [...newBanks];
    updated[index] = { ...updated[index], [field]: value };
    setNewBanks(updated);
  };

  const handleAddBank = () => {
    const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
    setNewBanks([...newBanks, { id: tempId }]);
  };

  const handleRemoveBank = async (index) => {
    const bank = newBanks[index];
    if (bank.id && !bank.id.startsWith('temp-')) {
      if (!window.confirm('Delete this bank account?')) return;
      try {
        await vendorApi.banking.delete(bank.id);
        await onRefresh();
        toast({ title: "Bank Deleted" });
      } catch (e) {
        toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
        return;
      }
    }
    const updated = newBanks.filter((_, i) => i !== index);
    const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
    setNewBanks(updated.length > 0 ? updated : [{ id: tempId }]);
  };

  const handleSaveAllBanks = async () => {
    setAdding(true);
    try {
      for (const bank of newBanks) {
        if (bank.id?.startsWith('temp-')) {
          if (bank.account_number && bank.ifsc_code) {
            await vendorApi.banking.add(bank);
          }
        }
      }
      await onRefresh();
      toast({ title: "Bank accounts saved" });
    } catch (e) {
      toast({ title: "Error saving banks", description: e?.message || "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="font-bold text-lg text-slate-900">Bank Accounts</h3>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#003D82] h-8 text-xs font-semibold hover:bg-blue-50"
          onClick={handleAddBank}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Another
        </Button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-3" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9'
      }}>
        {newBanks.map((bank, index) => (
          <div key={bank.id} className="bg-slate-50 p-4 rounded-lg border animate-in fade-in">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold">Bank Account {index + 1}</h4>
              <Trash2
                className="w-4 h-4 text-slate-400 hover:text-red-500 cursor-pointer"
                onClick={() => handleRemoveBank(index)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Account Number"
                className="h-9 bg-white"
                value={bank.account_number || ''}
                onChange={e => handleUpdateBank(index, 'account_number', e.target.value)}
              />
              <Input
                placeholder="IFSC Code"
                className="h-9 bg-white"
                value={bank.ifsc_code || ''}
                onChange={e => handleUpdateBank(index, 'ifsc_code', e.target.value)}
              />
              <Input
                placeholder="Bank Name"
                className="h-9 bg-white"
                value={bank.bank_name || ''}
                onChange={e => handleUpdateBank(index, 'bank_name', e.target.value)}
              />
              <Input
                placeholder="Branch Name"
                className="h-9 bg-white"
                value={bank.branch_name || ''}
                onChange={e => handleUpdateBank(index, 'branch_name', e.target.value)}
              />
              <Input
                placeholder="Account Holder Name"
                className="h-9 bg-white md:col-span-2"
                value={bank.account_holder || ''}
                onChange={e => handleUpdateBank(index, 'account_holder', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button
          className="bg-[#003D82]"
          onClick={handleSaveAllBanks}
          disabled={adding}
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Bank Details
        </Button>
      </div>
    </div>
  );
};

const DocumentsSection = ({ documents, onRefresh, kycStatus }) => {
  const [uploadingType, setUploadingType] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploadingType(type);
    try {
      await vendorApi.documents.upload(file, type);
      await onRefresh();
      toast({ title: "Document uploaded successfully" });
    } catch (err) {
      console.error('Document upload error:', err);
      toast({
        title: "Upload failed",
        description: err?.message || "Please check your internet connection and try again",
        variant: "destructive"
      });
    } finally {
      setUploadingType(null);
      try { e.target.value = ""; } catch (_) {}
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await vendorApi.documents.delete(id);
      await onRefresh();
      toast({ title: "Document Deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const docTypes = [
    { id: 'GST', label: 'GST Certificate' },
    { id: 'PAN', label: 'PAN Card' },
    { id: 'AADHAR', label: 'Aadhar Card' },
    { id: 'BANK', label: 'Bank Passbook/Cheque Copy' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg">KYC Documents</h3>
        <Badge>{kycStatus || 'PENDING'}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docTypes.map(type => {
          const doc = documents.find(d => d.document_type === type.id);

          return (
            <div key={type.id} className="border rounded-lg p-4 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${doc ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                  {doc ? <Check className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-700">{type.label}</p>
                  <p className="text-[10px] text-slate-400">
                    {doc ? `Uploaded ${new Date(doc.uploaded_at).toLocaleDateString()}` : 'Pending Upload'}
                  </p>
                </div>
              </div>

              {doc ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={doc.document_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className={`px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded ${uploadingType === type.id ? 'opacity-50' : ''}`}>
                    {uploadingType === type.id ? 'Uploading...' : 'Upload'}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => handleUpload(e, type.id)}
                    disabled={!!uploadingType}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end border-t pt-4">
        <Button
          className="bg-[#003D82] px-8"
          disabled={submitting || kycStatus === 'SUBMITTED' || kycStatus === 'VERIFIED'}
          onClick={async () => {
            setSubmitting(true);
            try {
              await vendorApi.kyc.submit();
              await onRefresh();
              toast({ title: "KYC Submitted" });
            } catch (e) {
              toast({ title: "Submit failed", description: e?.message || "", variant: "destructive" });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            (kycStatus === 'SUBMITTED' ? 'Verification In Progress' : 'Submit for Verification')
          )}
        </Button>
      </div>
    </div>
  );
};

export default Profile;
