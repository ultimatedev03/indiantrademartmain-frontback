import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { quotationApi } from '@/modules/vendor/services/quotationApi';
import { useAuth } from '@/modules/vendor/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

const SendQuotation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [buyers, setBuyers] = useState([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/vendor/login');
    }
  }, [user, navigate]);
  
  const [formData, setFormData] = useState({
    product_id: '',
    buyer_id: '',
    buyer_email: '',
    quotation_title: '',
    quotation_amount: '',
    quantity: '',
    unit: 'pieces',
    validity_days: 30,
    terms_conditions: '',
    delivery_days: '',
    status: 'SENT'
  });

  useEffect(() => {
    loadProductsAndBuyers();
  }, []);

  const loadProductsAndBuyers = async () => {
    setLoading(true);
    try {
      // Load vendor's products
      const productsData = await vendorApi.products.list();
      setProducts(Array.isArray(productsData) ? productsData : []);

      // Load buyers from purchased leads (actual contacts)
      try {
        const result = await vendorApi.leads.getMyLeads();
        const leadsData = Array.isArray(result) ? result : (result?.data || []);
        
        // Extract unique buyers from purchased leads
        const buyerMap = new Map();
        leadsData.forEach(lead => {
          if (lead.buyer_email && !buyerMap.has(lead.buyer_email)) {
            buyerMap.set(lead.buyer_email, {
              id: lead.id,
              email: lead.buyer_email,
              buyer_name: lead.buyer_name,
              company_name: lead.company_name,
              phone: lead.buyer_phone
            });
          }
        });
        setBuyers(Array.from(buyerMap.values()));
      } catch (e) {
        console.warn('Could not load buyers:', e);
        setBuyers([]);
      }
    } catch (error) {
      toast({ title: 'Error loading data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.buyer_email || !formData.quotation_title || !formData.quotation_amount) {
      toast({ 
        title: 'Please fill required fields',
        description: 'Buyer Email, Title, and Amount are required',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Send quotation via API (handles email and notification)
      const quotation = await quotationApi.sendQuotation({
        quotation_title: formData.quotation_title,
        quotation_amount: formData.quotation_amount,
        quantity: formData.quantity || null,
        unit: formData.unit,
        validity_days: formData.validity_days,
        delivery_days: formData.delivery_days || null,
        terms_conditions: formData.terms_conditions || '',
        buyer_id: formData.buyer_id || null,
        buyer_email: formData.buyer_email.toLowerCase().trim()
      });

      toast({ 
        title: '✅ Quotation Sent!',
        description: `Quotation sent to ${formData.buyer_email} with email notification`
      });

      // Reset form
      setFormData({
        product_id: '',
        buyer_id: '',
        buyer_email: '',
        quotation_title: '',
        quotation_amount: '',
        quantity: '',
        unit: 'pieces',
        validity_days: 30,
        terms_conditions: '',
        delivery_days: '',
        status: 'SENT'
      });

      // Redirect to proposals page
      setTimeout(() => navigate('/vendor/proposals?tab=sent'), 1000);
    } catch (error) {
      toast({ 
        title: 'Error sending quotation',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate('/vendor/proposals')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Proposals
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Send Quotation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Buyer Selection */}
            <div className="space-y-2">
              <Label htmlFor="buyer">Select from Previous Leads (Optional)</Label>
              <Select value={formData.buyer_id} onValueChange={(val) => {
                if (val) {
                  const buyer = buyers.find(b => b.id === val);
                  setFormData(prev => ({
                    ...prev,
                    buyer_id: val,
                    buyer_email: buyer?.email || ''
                  }));
                }
              }}>
                <SelectTrigger id="buyer">
                  <SelectValue placeholder="Choose from previous leads" />
                </SelectTrigger>
                <SelectContent>
                  {buyers.length > 0 ? (
                    buyers.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.buyer_name || 'Unknown'} - {b.email}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="no-buyers">No previous leads found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Buyers from your purchased leads appear here</p>
            </div>

            {/* Buyer Email - Manual Entry */}
            <div className="space-y-2">
              <Label htmlFor="buyer-email">Buyer Email *</Label>
              <Input
                id="buyer-email"
                type="email"
                value={formData.buyer_email}
                onChange={(e) => setFormData(prev => ({ ...prev, buyer_email: e.target.value }))}
                placeholder="buyer@example.com"
                required
              />
              <p className="text-xs text-slate-500">Email address to send quotation</p>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product">Product/Service *</Label>
              <Select value={formData.product_id} onValueChange={(val) => {
                const product = products.find(p => p.id === val);
                setFormData(prev => ({
                  ...prev,
                  product_id: val,
                  quotation_title: product?.name || ''
                }));
              }}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (₹{p.price}/{p.price_unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quotation Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Quotation Title *</Label>
              <Input
                id="title"
                value={formData.quotation_title}
                onChange={(e) => setFormData(prev => ({ ...prev, quotation_title: e.target.value }))}
                placeholder="e.g., Land Surveying Services Quote"
                required
              />
            </div>

            {/* Amount and Quantity */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.quotation_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, quotation_amount: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={formData.unit} onValueChange={(val) => setFormData(prev => ({ ...prev, unit: val }))}>
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="m">Meter</SelectItem>
                    <SelectItem value="sqft">Sq Ft</SelectItem>
                    <SelectItem value="hour">Hour</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Validity and Delivery */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validity">Validity (Days)</Label>
                <Input
                  id="validity"
                  type="number"
                  value={formData.validity_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, validity_days: e.target.value }))}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery">Delivery (Days)</Label>
                <Input
                  id="delivery"
                  type="number"
                  value={formData.delivery_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_days: e.target.value }))}
                  placeholder="7"
                />
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2">
              <Label htmlFor="terms">Terms & Conditions</Label>
              <textarea
                id="terms"
                className="w-full min-h-[120px] p-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.terms_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
                placeholder="Payment terms, delivery terms, warranty, etc."
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/vendor/proposals')}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#003D82]" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Quotation'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SendQuotation;
