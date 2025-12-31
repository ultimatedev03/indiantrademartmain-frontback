
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Loader2, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { buyerApi } from '@/modules/buyer/services/buyerApi';
import { toast } from '@/components/ui/use-toast';

const Proposals = () => {
  const { buyerId } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (buyerId) {
      loadProposals();
    }
  }, [buyerId]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await buyerApi.getProposals(buyerId);
      setProposals(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load proposals", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals.filter(p => 
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'OPEN': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      case 'ACTIVE': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">My Proposals</h1>
           <p className="text-gray-500">Track and manage your posted requirements</p>
        </div>
        <Link to="/buyer/proposals/new">
          <Button className="bg-[#003D82]">
            <Plus className="mr-2 h-4 w-4" /> New Proposal
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="Search proposals..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg bg-gray-50">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No proposals found</h3>
            <p className="mt-1 text-sm text-gray-500">Create your first proposal to get started.</p>
            <div className="mt-6">
              <Link to="/buyer/proposals/new">
                <Button variant="outline">Create Proposal</Button>
              </Link>
            </div>
          </div>
        ) : (
          filteredProposals.map((proposal) => (
            <Card key={proposal.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg text-[#003D82]">{proposal.title || proposal.product_name}</h3>
                      <Badge className={`${getStatusColor(proposal.status)} border-0`}>
                        {proposal.status || 'OPEN'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-400 block text-xs">Quantity</span>
                        {proposal.quantity} Units
                      </div>
                      <div>
                        <span className="text-gray-400 block text-xs">Budget</span>
                        ₹{proposal.budget?.toLocaleString()}
                      </div>
                      <div className="col-span-2 sm:col-span-2">
                        <span className="text-gray-400 block text-xs">Posted On</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(proposal.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm">View Quotes</Button>
                    <Button variant="ghost" size="sm" className="text-gray-500">Details</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Proposals;
