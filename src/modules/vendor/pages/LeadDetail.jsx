
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/shared/components/Badge';
import { MapPin, Calendar, Phone, Mail, User, ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);

  useEffect(() => {
    const fetchLead = async () => {
      try {
        // Check if already purchased
        const myLeads = await vendorApi.leads.getMyLeads();
        const existing = myLeads.find(l => l.id === id);
        
        if (existing) {
          setLead(existing);
          setIsPurchased(true);
        } else {
          // Fetch from marketplace (mocked via getMarketplaceLeads for now as we don't have single get endpoint in API yet, 
          // but in real app we would have get(id))
          const marketLeads = await vendorApi.leads.getMarketplaceLeads();
          const marketLead = marketLeads.find(l => l.id === id);
          if (marketLead) {
            setLead(marketLead);
            setIsPurchased(false);
          } else {
             // Fallback if not found in list (e.g. direct link)
             // In real implementation, add get(id) to API
             toast({ title: "Lead not found", variant: "destructive" });
             navigate('/vendor/leads');
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLead();
  }, [id, navigate]);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await vendorApi.leads.purchase(lead.id);
      toast({ title: "Lead Purchased Successfully!", description: "Contact details are now visible." });
      setIsPurchased(true);
      // Refresh data
      const myLeads = await vendorApi.leads.getMyLeads();
      const updated = myLeads.find(l => l.id === id);
      if (updated) setLead(updated);
    } catch (error) {
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading details...</div>;
  if (!lead) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate('/vendor/leads')} className="pl-0 hover:pl-2 transition-all">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <Badge variant="outline" className="mb-2">{lead.category || 'General'}</Badge>
              <CardTitle className="text-2xl text-[#003D82]">{lead.title}</CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {lead.location}</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(lead.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Lead ID</p>
              <p className="font-mono font-medium">#{lead.id.slice(0,8)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Quantity</p>
              <p className="font-medium">{lead.quantity || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Budget</p>
              <p className="font-medium">{lead.budget || 'Negotiable'}</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Requirement Details</h3>
            <p className="text-gray-700 leading-relaxed">
              {lead.message || lead.description || "Buyer is interested in this product. Please contact for more details."}
            </p>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Buyer Information</h3>
            {isPurchased ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-green-700" />
                  <span className="font-medium text-green-900">{lead.buyer_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-green-700" />
                  <a href={`tel:${lead.buyer_phone}`} className="text-green-900 hover:underline">{lead.buyer_phone}</a>
                </div>
                {lead.buyer_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-green-700" />
                    <a href={`mailto:${lead.buyer_email}`} className="text-green-900 hover:underline">{lead.buyer_email}</a>
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-green-200 flex gap-3">
                   <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => window.location.href=`tel:${lead.buyer_phone}`}>
                     Call Now
                   </Button>
                   <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-100">
                     Send Email
                   </Button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <Lock className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Contact details are locked</p>
                  <p className="text-sm text-gray-500">Purchase this lead to view buyer phone number and email.</p>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-left">
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-2xl font-bold text-[#003D82]">₹{lead.price || 500}</p>
                  </div>
                  <Button size="lg" className="bg-[#00A699] hover:bg-[#00857A]" onClick={handlePurchase} disabled={purchasing}>
                    {purchasing ? 'Processing...' : 'Unlock Contact Details'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadDetail;
