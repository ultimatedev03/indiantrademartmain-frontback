import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Calendar, User, FileText, Plus } from 'lucide-react';

const Proposals = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('received');
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProposals();
  }, [activeTab]);

  const loadProposals = async () => {
    setLoading(true);
    try {
       const data = await vendorApi.proposals.list(activeTab);
       setProposals(data || []);
    } catch (e) {
       console.error(e);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div>
             <h1 className="text-2xl font-bold text-gray-900">My Proposals</h1>
             <p className="text-gray-500">Manage your sent and received quotations</p>
          </div>
          <Button className="bg-[#003D82]" onClick={() => navigate('/vendor/proposals/send')}>
             <Plus className="mr-2 h-4 w-4" /> Send Quotation
          </Button>
       </div>

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
             <TabsTrigger value="received">Received Requests</TabsTrigger>
             <TabsTrigger value="sent">Sent Quotations</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-4 mt-6">
             {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin"/></div> : 
               proposals.length === 0 ? <div className="text-center p-8 border rounded bg-white text-gray-500">No proposals found.</div> :
               proposals.map(prop => (
                 <Card key={prop.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                       <div className="flex justify-between items-start">
                          <div>
                             <h3 className="font-bold text-lg text-[#003D82] mb-1">{prop.title}</h3>
                             <div className="text-sm text-gray-500 mb-4">
                                Requested by <span className="font-medium text-gray-800">{prop.buyers?.full_name}</span> on {new Date(prop.created_at).toLocaleDateString()}
                             </div>
                             <div className="flex gap-2">
                                <Badge variant="secondary">{prop.status}</Badge>
                                {prop.budget && <Badge variant="outline">Budget: ₹{prop.budget}</Badge>}
                             </div>
                          </div>
                          <Button>View Details</Button>
                       </div>
                    </CardContent>
                 </Card>
               ))
             }
          </TabsContent>
          
           <TabsContent value="sent" className="space-y-4 mt-6">
             {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin"/></div> : 
               proposals.length === 0 ? <div className="text-center p-8 border rounded bg-white text-gray-500">No sent quotations yet. Create quotations to send to buyers.</div> :
               proposals.map(prop => (
                 <Card key={prop.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                       <div className="flex justify-between items-start">
                          <div>
                             <h3 className="font-bold text-lg text-[#003D82] mb-1">{prop.title}</h3>
                             <div className="text-sm text-gray-500 mb-4">
                                Sent to <span className="font-medium text-gray-800">{prop.buyers?.full_name || 'Customer'}</span> on {new Date(prop.created_at).toLocaleDateString()}
                             </div>
                             <div className="flex gap-2">
                                <Badge variant="secondary">{prop.status || 'PENDING'}</Badge>
                                {prop.quotation_amount && <Badge variant="outline">₹{prop.quotation_amount}</Badge>}
                             </div>
                          </div>
                          <Button>View Details</Button>
                       </div>
                    </CardContent>
                 </Card>
               ))
             }
          </TabsContent>
       </Tabs>
    </div>
  );
};

export default Proposals;