import React, { useEffect, useState } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { leadsMarketplaceApi } from '@/modules/vendor/services/leadsMarketplaceApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapPin, Calendar, Search, Phone, Mail, Lock, ShoppingCart, BarChart3, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { phoneUtils } from '@/shared/utils/phoneUtils';

const Leads = () => {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [purchasing, setPurchasing] = useState({});

  useEffect(() => {
    loadLeads();
    loadStats();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const data = await leadsMarketplaceApi.getLeadStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      let data = [];
      if (activeTab === 'my_leads') {
        const result = await leadsMarketplaceApi.getPurchasedLeads();
        data = result.data || [];
      } else {
        const result = await leadsMarketplaceApi.getAvailableLeads();
        data = result.data || [];
      }
      setLeads(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: "Failed to load leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseLead = async (leadId) => {
    setPurchasing({ ...purchasing, [leadId]: true });
    try {
      await leadsMarketplaceApi.purchaseLead(leadId);
      toast({ title: "Lead purchased successfully!" });
      await loadLeads();
      await loadStats();
    } catch (error) {
      toast({ title: "Failed to purchase lead", description: error.message, variant: "destructive" });
    } finally {
      setPurchasing({ ...purchasing, [leadId]: false });
    }
  };

  const filteredLeads = leads.filter(l => 
    (l.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buy Leads</h1>
          <p className="text-gray-500">Access verified buyer requirements</p>
        </div>
        {stats && (
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-gray-500">Purchased</p>
              <p className="text-lg font-bold text-[#003D82]">{stats.totalPurchased}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Contacted</p>
              <p className="text-lg font-bold text-[#003D82]">{stats.totalContacted}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Converted</p>
              <p className="text-lg font-bold text-green-600">{stats.converted}</p>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="my_leads">My Leads</TabsTrigger>
        </TabsList>

        <div className="my-4 flex gap-4">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search product or location..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <TabsContent value="marketplace" className="space-y-4">
           {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : 
            filteredLeads.length === 0 ? <div className="p-8 text-center border rounded bg-white">No new leads available</div> :
            filteredLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} purchased={false} onBuy={handlePurchaseLead} isPurchasing={purchasing[lead.id]} />
            ))
           }
        </TabsContent>

        <TabsContent value="my_leads" className="space-y-4">
           {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : 
            filteredLeads.length === 0 ? <div className="p-8 text-center border rounded bg-white">You haven't purchased any leads yet.</div> :
            filteredLeads.map(lead => {
              const leadData = lead.leads || lead;
              return (
                <LeadCard 
                  key={lead.id} 
                  lead={leadData} 
                  purchased={true}
                  purchaseDate={lead.purchase_date}
                />
              );
            })
           }
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LeadCard = ({ lead, purchased, onBuy, isPurchasing, purchaseDate }) => {
  const displayTitle = lead.title || lead.product_name || 'Untitled Lead';
  const displayLocation = lead.location || 'India';
  const displayDate = new Date(purchased ? purchaseDate : lead.created_at).toLocaleDateString();
  const maskPhone = (phone) => phone ? phoneUtils.maskPhoneWithCode(phone) : 'N/A';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg text-[#003D82]">{displayTitle}</h3>
              <Badge variant={purchased ? 'success' : 'outline'}>{purchased ? 'Purchased' : 'Fresh Lead'}</Badge>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {displayLocation}</div>
              <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {displayDate}</div>
              {lead.quantity && <div className="font-medium">Qty: {lead.quantity} {lead.unit || 'units'}</div>}
              {lead.budget && <div className="font-medium">Budget: ₹{lead.budget?.toLocaleString?.() || lead.budget}</div>}
            </div>

            {purchased ? (
              <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-md space-y-1">
                <p className="text-sm font-semibold text-green-800">Buyer Details:</p>
                <div className="flex flex-wrap gap-4 text-sm text-green-700">
                  <span className="font-medium">{lead.buyer_name || 'N/A'}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {maskPhone(lead.buyer_phone)}</span>
                  {lead.buyer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.buyer_email}</span>}
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded w-fit">
                <Lock className="h-3 w-3" /> Buyer details locked
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center items-end gap-2 min-w-[140px]">
            {!purchased && (
              <>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-xl font-bold text-gray-900">₹50</p>
                </div>
                <Button 
                  onClick={() => onBuy?.(lead.id)}
                  disabled={isPurchasing}
                  className="w-full bg-[#00A699] hover:bg-[#00857A]">
                  <ShoppingCart className="w-4 h-4 mr-2" /> {isPurchasing ? 'Buying...' : 'Buy Now'}
                </Button>
              </>
            )}
            <Button variant="outline" className="w-full">View Details</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Leads;