import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Search, CheckCircle, XCircle, Eye, FileText, Loader2, ShieldAlert, Building2, Mail, Phone, MapPin, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KYCApproval = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  // Modal States
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorDocs, setVendorDocs] = useState([]);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadVendors();
  }, [filterStatus]);

  const loadVendors = async () => {
    setLoading(true);
    try {
      let query = supabase.from('vendors').select('*, products(count)').order('created_at', { ascending: false });
      
      if (filterStatus && filterStatus !== 'all') {
        const statusMap = { 'pending': 'PENDING', 'approved': 'APPROVED', 'rejected': 'REJECTED', 'submitted': 'SUBMITTED' };
        query = query.eq('kyc_status', statusMap[filterStatus] || filterStatus.toUpperCase());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      let filtered = data || [];
      if (searchTerm) {
        filtered = filtered.filter(v => 
          v.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setVendors(filtered);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadVendors();
  };

  const handleApprove = async (vendor) => {
    if (!window.confirm(`Approve KYC for ${vendor.company_name}?`)) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ kyc_status: 'APPROVED', is_verified: true, verified_at: new Date().toISOString() })
        .eq('id', vendor.id);
      if (error) throw error;
      toast({ title: "Success", description: "Vendor KYC Approved" });
      loadVendors();
      setShowDocsModal(false);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) {
      toast({ title: "Required", description: "Please enter rejection remarks", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ kyc_status: 'REJECTED', is_verified: false, rejection_reason: rejectRemarks })
        .eq('id', selectedVendor.id);
      if (error) throw error;
      toast({ title: "Success", description: "Vendor KYC Rejected" });
      loadVendors();
      setShowRejectModal(false);
      setShowDocsModal(false);
      setRejectRemarks('');
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const openDocs = async (vendor) => {
    setSelectedVendor(vendor);
    setShowDocsModal(true);
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('vendor_id', vendor.id);
      if (error) throw error;
      setVendorDocs(data || []);
    } catch (e) {
      toast({ title: "Error", description: "Could not load documents" });
    }
  };

  const getKycBadgeStyle = (status) => {
    const styles = {
      'APPROVED': 'bg-green-100 text-green-800',
      'VERIFIED': 'bg-green-100 text-green-800',
      'SUBMITTED': 'bg-yellow-100 text-yellow-800',
      'PENDING': 'bg-gray-100 text-gray-800',
      'REJECTED': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const openReject = (vendor) => {
    setSelectedVendor(vendor);
    setShowRejectModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Vendor Management</h1>
          <p className="text-gray-500">View and manage all vendors and KYC approvals</p>
        </div>
        <Badge variant="outline" className="text-sm">{vendors.length} Total Vendors</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-lg border">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input 
            className="pl-9" 
            placeholder="Search by company name, owner or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner / Contact</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin mx-auto h-6 w-6 text-gray-400" /></TableCell></TableRow>
              ) : vendors.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500"><Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />No vendors found</TableCell></TableRow>
              ) : (
                vendors.map((vendor) => (
                  <TableRow key={vendor.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{vendor.company_name}</p>
                          <p className="text-xs text-gray-500">{vendor.business_type || 'Business'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{vendor.owner_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" />{vendor.email}</div>
                      {vendor.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" />{vendor.phone}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge className={getKycBadgeStyle(vendor.kyc_status)}>
                        {vendor.kyc_status === 'VERIFIED' ? 'APPROVED' : vendor.kyc_status || 'PENDING'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-gray-600">{vendor.products?.[0]?.count || 0}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDocs(vendor)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                        {(vendor.kyc_status === 'PENDING' || vendor.kyc_status === 'SUBMITTED') && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(vendor)}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openReject(vendor)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Documents Modal */}
      <Dialog open={showDocsModal} onOpenChange={setShowDocsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Documents: {selectedVendor?.company_name}</DialogTitle>
            <DialogDescription>Review submitted documents before approval.</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {vendorDocs.map((doc, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm capitalize">{doc.document_type?.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
                <div className="aspect-video bg-gray-100 rounded flex items-center justify-center overflow-hidden relative group">
                  {doc.file_path?.endsWith('.pdf') ? (
                    <FileText className="w-12 h-12 text-gray-400" />
                  ) : (
                    <img src={doc.file_path} alt="Doc" className="object-cover w-full h-full" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a href={doc.file_path} target="_blank" rel="noreferrer">
                      <Button variant="secondary" size="sm">View Full</Button>
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {vendorDocs.length === 0 && (
              <div className="col-span-2 text-center py-8 text-gray-500">
                No documents uploaded.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedVendor?.kyc_status === 'PENDING' && (
              <>
                <Button variant="destructive" onClick={() => { setShowDocsModal(false); openReject(selectedVendor); }}>
                  Reject KYC
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(selectedVendor)}>
                  Approve KYC
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowDocsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Reject KYC
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be sent to the vendor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="e.g. Document blurry, Name mismatch..." 
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="animate-spin mr-2" /> : null} Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KYCApproval;
