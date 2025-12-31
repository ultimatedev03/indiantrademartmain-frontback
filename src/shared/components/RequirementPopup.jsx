
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StateDropdown, CityDropdown } from '@/shared/components/LocationSelectors';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';

const RequirementPopup = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    requirement_description: '',
    budget: '',
    timeline: '',
    state_id: '',
    city_id: ''
  });

  useEffect(() => {
    // Logic to show popup
    // 1. Check if user is logged in -> Don't show
    if (user) return;

    // 2. Check if already submitted or dismissed in session/local
    const hasSeen = sessionStorage.getItem('req_popup_seen');
    const dismissed = localStorage.getItem('req_popup_dismissed');

    if (!hasSeen && !dismissed) {
      const timer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem('req_popup_seen', 'true');
      }, 5000); // Show after 5 seconds on page
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('requirements').insert([
        {
          ...formData,
          status: 'Pending'
        }
      ]);

      if (error) throw error;

      toast({ title: "Requirement Submitted!", description: "We will contact you shortly." });
      setOpen(false);
      
      if (dontShowAgain) {
         localStorage.setItem('req_popup_dismissed', 'true');
      }

    } catch (error) {
      console.error("Submission failed", error);
      toast({ title: "Error", description: "Failed to submit requirement.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen) => {
     setOpen(isOpen);
     if (!isOpen && dontShowAgain) {
        localStorage.setItem('req_popup_dismissed', 'true');
     }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tell Us What You Need</DialogTitle>
          <DialogDescription>
            Submit your requirement and get quotes from verified vendors.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <Label>Full Name *</Label>
                 <Input name="name" required value={formData.name} onChange={handleChange} placeholder="Your Name" />
              </div>
              <div>
                 <Label>Phone *</Label>
                 <Input name="phone" required value={formData.phone} onChange={handleChange} placeholder="Mobile No." />
              </div>
           </div>

           <div>
              <Label>Email *</Label>
              <Input name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="you@company.com" />
           </div>

           <div>
              <Label>Company (Optional)</Label>
              <Input name="company_name" value={formData.company_name} onChange={handleChange} placeholder="Company Name" />
           </div>

           <div>
              <Label>Requirement Description *</Label>
              <Textarea 
                name="requirement_description" 
                required 
                value={formData.requirement_description} 
                onChange={handleChange} 
                placeholder="Product name, specifications, quantity..." 
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <Label>Budget (Optional)</Label>
                 <Input name="budget" value={formData.budget} onChange={handleChange} placeholder="₹ 10k - 50k" />
              </div>
              <div>
                 <Label>Timeline (Optional)</Label>
                 <Input name="timeline" value={formData.timeline} onChange={handleChange} placeholder="Immediate" />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <Label>State</Label>
                 <StateDropdown value={formData.state_id} onChange={(id) => setFormData(prev => ({ ...prev, state_id: id, city_id: '' }))} />
              </div>
              <div className="space-y-1">
                 <Label>City</Label>
                 <CityDropdown stateId={formData.state_id} value={formData.city_id} onChange={(id) => setFormData(prev => ({ ...prev, city_id: id }))} />
              </div>
           </div>

           <div className="flex items-center space-x-2 pt-2">
              <input 
                 type="checkbox" 
                 id="dontShow" 
                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                 checked={dontShowAgain}
                 onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <label htmlFor="dontShow" className="text-sm text-gray-500 cursor-pointer">
                 Don't show this again
              </label>
           </div>

           <Button type="submit" className="w-full bg-[#003D82]" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Requirement
           </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RequirementPopup;
