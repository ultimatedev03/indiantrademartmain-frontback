
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { toast } from '@/components/ui/use-toast';

const Settings = () => {
  const [settings, setSettings] = useState({
    commissionRate: 5,
    maxUploadSize: 10,
    maintenanceMode: false,
    allowVendorRegistration: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_config')
          .select('*')
          .limit(1)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setSettings(prev => ({
            ...prev,
            maintenanceMode: data.maintenance_mode || false
          }));
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'general_settings',
          maintenance_mode: settings.maintenanceMode,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      toast({ title: "Settings Saved", description: "System configuration has been updated." });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({ title: "Error", description: "Failed to save settings. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-800">System Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="commission">Default Commission Rate (%)</Label>
                <Input 
                    type="number" 
                    id="commission" 
                    value={settings.commissionRate} 
                    onChange={(e) => handleChange('commissionRate', e.target.value)}
                />
             </div>
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="uploadSize">Max File Upload Size (MB)</Label>
                <Input 
                    type="number" 
                    id="uploadSize" 
                    value={settings.maxUploadSize}
                    onChange={(e) => handleChange('maxUploadSize', e.target.value)}
                />
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature Toggles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="maintenance-mode" className="flex flex-col space-y-1">
                  <span>Maintenance Mode</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Disable access for all non-admin users.
                  </span>
                </Label>
                <Switch 
                    id="maintenance-mode" 
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => handleChange('maintenanceMode', checked)}
                />
             </div>
             
             <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="vendor-reg" className="flex flex-col space-y-1">
                  <span>Allow Vendor Registration</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Open public registration for new vendors.
                  </span>
                </Label>
                <Switch 
                    id="vendor-reg" 
                    checked={settings.allowVendorRegistration}
                    onCheckedChange={(checked) => handleChange('allowVendorRegistration', checked)}
                />
             </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-[#003D82]">Save Changes</Button>
      </div>
    </div>
  );
};

export default Settings;
