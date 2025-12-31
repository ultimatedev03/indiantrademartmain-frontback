
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/shared/components/Badge';
import { Check, Zap, ShoppingCart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/modules/vendor/context/AuthContext';

const Services = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);

  useEffect(() => {
    const fetchVendorId = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id')
            .eq('user_id', authUser.id)
            .single();
          setVendorId(vendor?.id);
        }
      } catch (e) {
        console.error('Error fetching vendor ID:', e);
      }
    };
    
    if (user && !vendorId) {
      fetchVendorId();
    }
  }, [user, vendorId]);

  useEffect(() => {
    if (vendorId) {
      loadData();
    }
  }, [vendorId]);

  const loadData = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      // 1. Fetch Plans
      const { data: plansData } = await supabase.from('vendor_plans').select('*').order('price');
      setPlans(plansData || []);

      // 2. Fetch Active Sub
      const { data: sub } = await supabase.from('vendor_plan_subscriptions')
         .select('*, plan:vendor_plans(name)')
         .eq('vendor_id', vendorId)
         .eq('status', 'ACTIVE')
         .maybeSingle();
      setCurrentSub(sub);

      // 3. Fetch Quota
      const { data: q } = await supabase.from('vendor_lead_quota')
         .select('*')
         .eq('vendor_id', vendorId)
         .maybeSingle();
      setQuota(q);
    } catch (e) {
      console.error('Error loading subscription data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
     if (!vendorId) {
        toast({ title: "Error", description: "Vendor ID not found", variant: "destructive" });
        return;
     }
     toast({ title: "Processing Payment...", description: `Subscribing to ${plan.name}` });
     
     setTimeout(async () => {
        try {
           await supabase.from('vendor_plan_subscriptions').insert({
              vendor_id: vendorId,
              plan_id: plan.id,
              status: 'ACTIVE'
           });
           toast({ title: "Success!", description: "Plan activated." });
           loadData();
        } catch (e) {
           toast({ title: "Error", description: e.message, variant: "destructive" });
        }
     }, 1500);
  };

  const buyLeads = async () => {
     if (!vendorId) {
        toast({ title: "Error", description: "Vendor ID not found", variant: "destructive" });
        return;
     }
     if(window.confirm("Buy 10 additional leads for ₹1500?")) {
        try {
           await supabase.from('vendor_additional_leads').insert({
              vendor_id: vendorId,
              leads_purchased: 10,
              leads_remaining: 10,
              amount_paid: 1500
           });
           toast({ title: "Leads Purchased", description: "10 leads added to your account." });
           loadData();
        } catch (e) {
           toast({ title: "Error", description: e.message, variant: "destructive" });
        }
     }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-2 animate-pulse" />
          <p className="text-slate-500">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Quota Widget */}
      {quota && (
         <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-lg flex justify-between">
                  <span>Lead Quota Usage</span>
                  <Button size="sm" variant="outline" onClick={buyLeads} className="bg-white hover:bg-blue-50">
                     <ShoppingCart className="w-4 h-4 mr-2" /> Buy More Leads
                  </Button>
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                     <p className="text-xs text-gray-500 uppercase">Daily</p>
                     <p className="text-xl font-bold text-blue-600">{quota.daily_used} <span className="text-gray-400 text-sm">/ {quota.daily_limit}</span></p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                     <p className="text-xs text-gray-500 uppercase">Weekly</p>
                     <p className="text-xl font-bold text-blue-600">{quota.weekly_used} <span className="text-gray-400 text-sm">/ {quota.weekly_limit}</span></p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                     <p className="text-xs text-gray-500 uppercase">Yearly</p>
                     <p className="text-xl font-bold text-blue-600">{quota.yearly_used} <span className="text-gray-400 text-sm">/ {quota.yearly_limit}</span></p>
                  </div>
               </div>
            </CardContent>
         </Card>
      )}

      <h1 className="text-2xl font-bold">Subscription Plans</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {plans.map(plan => (
            <Card key={plan.id} className={`flex flex-col relative ${currentSub?.plan_id === plan.id ? 'border-2 border-green-500 shadow-xl' : ''}`}>
               {currentSub?.plan_id === plan.id && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-3 py-1 rounded-bl-lg font-bold">
                     CURRENT
                  </div>
               )}
               <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-2">
                     <span className="text-3xl font-bold">₹{plan.price}</span>
                     <span className="text-gray-500">/year</span>
                  </div>
               </CardHeader>
               <CardContent className="flex-1 space-y-4">
                  <div className="space-y-2 text-sm">
                     <p><strong>Lead Limits:</strong></p>
                     <ul className="list-disc pl-5 text-gray-600">
                        <li>{plan.daily_limit} Leads / Day</li>
                        <li>{plan.weekly_limit} Leads / Week</li>
                        <li>{plan.yearly_limit} Leads / Year</li>
                     </ul>
                  </div>
                  <div className="space-y-2">
                     {plan.features?.map((f, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                           <Check className="w-4 h-4 text-green-500" /> {f}
                        </div>
                     ))}
                  </div>
               </CardContent>
               <CardFooter>
                  <Button 
                     className="w-full" 
                     variant={currentSub?.plan_id === plan.id ? "outline" : "default"}
                     disabled={currentSub?.plan_id === plan.id}
                     onClick={() => handleSubscribe(plan)}
                  >
                     {currentSub?.plan_id === plan.id ? "Active Plan" : "Upgrade"}
                  </Button>
               </CardFooter>
            </Card>
         ))}
      </div>
    </div>
  );
};

export default Services;
