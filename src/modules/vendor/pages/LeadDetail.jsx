import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadApi } from '@/modules/lead/services/leadApi';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Calendar,
  Phone,
  Mail,
  User,
  ArrowLeft,
  Lock,
  ShoppingCart,
  FileText,
  Package,
  IndianRupee,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const safeDate = (v) => {
  try {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
};

const formatDateTime = (d) => {
  if (!d) return '—';
  try {
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toLocaleDateString();
  }
};

const formatINR = (v) => {
  const n = Number(String(v || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString('en-IN');
};

// quantity is text in DB ("100 units" / "100" / "100 kg")
const parseQtyUnit = (lead) => {
  const raw =
    lead?.quantity ||
    lead?.qty ||
    lead?.min_order_qty ||
    lead?.minOrderQty ||
    '';

  const rawStr = String(raw || '').trim();
  const explicitUnit =
    lead?.unit ||
    lead?.qty_unit ||
    lead?.qtyUnit ||
    lead?.price_unit ||
    lead?.priceUnit ||
    '';

  if (!rawStr && !explicitUnit) return { qty: null, unit: null };

  // If rawStr like "100 units" or "100 kg"
  const parts = rawStr.split(' ').filter(Boolean);
  const first = parts[0];
  const maybeNum = Number(String(first).replace(/[^\d.]/g, ''));

  if (Number.isFinite(maybeNum) && parts.length > 1) {
    return { qty: String(maybeNum), unit: parts.slice(1).join(' ') };
  }

  // If rawStr is only number and unit separate
  if (Number.isFinite(maybeNum)) {
    return { qty: String(maybeNum), unit: explicitUnit ? String(explicitUnit) : null };
  }

  // If rawStr is not numeric (ex: "Not specified")
  return { qty: rawStr || null, unit: explicitUnit ? String(explicitUnit) : null };
};

const getDescription = (lead) => {
  return (
    lead?.message ||
    lead?.description ||
    lead?.details ||
    lead?.requirement_details ||
    ''
  );
};

const getBuyer = (lead) => {
  const name =
    lead?.buyer_name ||
    lead?.buyerName ||
    lead?.client_name ||
    lead?.clientName ||
    lead?.name ||
    null;

  const phone =
    lead?.buyer_phone ||
    lead?.buyerPhone ||
    lead?.phone ||
    null;

  const email =
    lead?.buyer_email ||
    lead?.buyerEmail ||
    lead?.email ||
    null;

  return { name, phone, email };
};

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);

  const loadLead = async () => {
    setLoading(true);
    try {
      // ✅ Get current vendor ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        navigate('/vendor/leads');
        return;
      }
      
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (!vendor?.id) {
        toast({ title: 'Vendor profile not found', variant: 'destructive' });
        navigate('/vendor/leads');
        return;
      }

      // ✅ Load the lead from database
      const leadData = await leadApi.get(id);
      if (!leadData) {
        toast({ title: 'Lead not found', variant: 'destructive' });
        navigate('/vendor/leads');
        return;
      }

      // ✅ Determine source based on vendor_id and purchase status
      let isPurchasedFlag = false;
      let source = 'Marketplace';
      let purchaseDate = null;

      // If current vendor is the creator, it's Direct
      if (leadData.vendor_id === vendor.id) {
        source = 'Direct';
        purchaseDate = leadData.created_at;
      } else {
        // Check if vendor purchased this lead
        const purchased = await leadApi.purchases.list(vendor.id);
        const purchasedLead = purchased.find(p => p.lead_id === id);
        if (purchasedLead) {
          source = 'Purchased';
          isPurchasedFlag = true;
          purchaseDate = purchasedLead.purchase_date;
        }
      }

      setLead({
        ...leadData,
        __source: source,
        __purchaseDate: purchaseDate
      });
      setIsPurchased(isPurchasedFlag);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Failed to load lead detail',
        description: err?.message || 'Something went wrong',
        variant: 'destructive',
      });
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const meta = useMemo(() => {
    const createdAt = safeDate(lead?.created_at || lead?.createdAt);
    const postedOn = formatDateTime(createdAt);

    const title =
      lead?.title ||
      lead?.product_name ||
      lead?.productName ||
      'Untitled Lead';

    const product =
      lead?.product_name ||
      lead?.productName ||
      lead?.product_interest ||
      lead?.productInterest ||
      null;

    const category =
      lead?.category ||
      lead?.category_name ||
      lead?.categoryName ||
      null;

    const location =
      lead?.location ||
      [lead?.city, lead?.state].filter(Boolean).join(', ') ||
      'India';

    const qtyUnit = parseQtyUnit(lead);
    const budgetPretty = formatINR(lead?.budget) || (lead?.budget ? String(lead.budget) : null);

    const desc = getDescription(lead);
    const buyer = getBuyer(lead);

    return { postedOn, title, product, category, location, qtyUnit, budgetPretty, desc, buyer };
  }, [lead]);

  const handlePurchase = async () => {
    if (!lead?.id) return;
    setPurchasing(true);
    try {
      await leadApi.purchases.create(undefined, lead.id, lead.price || 50);
      toast({ title: 'Lead Purchased Successfully!', description: 'Contact details are now visible.' });
      setIsPurchased(true);
      await loadLead();
    } catch (error) {
      toast({
        title: 'Purchase Failed',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  if (!lead) return null;

  const price = lead?.price ?? 50;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/vendor/leads')}
        className="pl-0 hover:pl-2 transition-all"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads
      </Button>

      {/* ✅ Header Card */}
      <Card className="border bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 mb-2">
                {meta.category ? <Badge variant="outline">{meta.category}</Badge> : <Badge variant="outline">General</Badge>}
                {meta.product ? <Badge variant="secondary">{meta.product}</Badge> : null}
                <Badge variant={isPurchased ? 'success' : lead?.__source === 'Direct' ? 'secondary' : 'outline'}>
                  {lead?.__source || (isPurchased ? 'Purchased' : 'Fresh Lead')}
                </Badge>
              </div>

              <CardTitle className="text-2xl text-[#003D82] truncate">
                {meta.title}
              </CardTitle>

              <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {meta.location}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Posted: {meta.postedOn}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-500">Lead ID</div>
              <div className="font-mono font-semibold text-gray-900">#{String(lead.id || '').slice(0, 8)}</div>

              {!isPurchased && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500">Price</div>
                  <div className="text-2xl font-bold text-gray-900">₹{price}</div>

                  <Button
                    className="mt-2 bg-[#00A699] hover:bg-[#00857A]"
                    onClick={handlePurchase}
                    disabled={purchasing}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {purchasing ? 'Processing...' : 'Buy & Unlock'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {/* ✅ Summary Row */}
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <Package className="h-4 w-4" /> Quantity
              </div>
              <div className="mt-1 font-semibold text-gray-900">
                {meta.qtyUnit.qty ? (
                  <>
                    {meta.qtyUnit.qty}{meta.qtyUnit.unit ? ` ${meta.qtyUnit.unit}` : ''}
                  </>
                ) : (
                  'Not specified'
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <IndianRupee className="h-4 w-4" /> Budget
              </div>
              <div className="mt-1 font-semibold text-gray-900">
                {meta.budgetPretty ? `₹${meta.budgetPretty}` : (lead?.budget ? String(lead.budget) : 'Negotiable')}
              </div>
            </div>

            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Lead Type
              </div>
              <div className="mt-1 font-semibold text-gray-900">
                {lead?.status ? String(lead.status).toUpperCase() : 'AVAILABLE'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Requirement Details */}
      <Card className="border bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Requirement Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {meta.desc?.trim()
              ? meta.desc.trim()
              : 'No description provided by buyer.'}
          </p>
        </CardContent>
      </Card>

      {/* ✅ Buyer Information */}
      <Card className="border bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Buyer Information</CardTitle>
        </CardHeader>
        <CardContent>
          {isPurchased || lead?.__source === 'Direct' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-green-700" />
                <div>
                  <div className="text-xs text-green-700">Buyer Name</div>
                  <div className="font-semibold text-green-900">
                    {meta.buyer.name || 'Buyer'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <Phone className="h-5 w-5 text-green-700" />
                  <div>
                    <div className="text-xs text-green-700">Phone</div>
                    <div className="font-semibold text-green-900">
                      {meta.buyer.phone || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-1">
                  <Mail className="h-5 w-5 text-green-700" />
                  <div>
                    <div className="text-xs text-green-700">Email</div>
                    <div className="font-semibold text-green-900">
                      {meta.buyer.email || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-green-200 flex flex-wrap gap-2">
                {meta.buyer.phone ? (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => (window.location.href = `tel:${meta.buyer.phone}`)}
                  >
                    Call Now
                  </Button>
                ) : null}

                {meta.buyer.email ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-100"
                    onClick={() => (window.location.href = `mailto:${meta.buyer.email}`)}
                  >
                    Send Email
                  </Button>
                ) : null}
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
                  <p className="text-2xl font-bold text-[#003D82]">₹{price}</p>
                </div>
                <Button
                  size="lg"
                  className="bg-[#00A699] hover:bg-[#00857A]"
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {purchasing ? 'Processing...' : 'Unlock Contact Details'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadDetail;
