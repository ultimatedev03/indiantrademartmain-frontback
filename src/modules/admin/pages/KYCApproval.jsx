
import React, { useEffect, useState } from 'react';
import { dataEntryApi } from '@/modules/employee/services/dataEntryApi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Search, CheckCircle, XCircle, Eye, FileText, Loader2, ShieldAlert } from 'lucide-react';
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
      const data = await dataEntryApi.getAllVendors({ 
        status: filterStatus, 
        search: searchTerm 
      });
      setVendors(data || []);
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
      await dataEntryApi.approveVendor(vendor.id);
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
      await dataEntryApi.rejectVendor(selectedVendor.id, rejectRemarks);
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
        const docs = await dataEntryApi.getKYCDocuments(vendor.id);
        setVendorDocs(docs || []);
    } catch (e) {
        toast({ title: "Error", description: "Could not load documents" });
    }
  };

  const openReject = (vendor) => {
    setSelectedVendor(vendor);
    setShowRejectModal(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">KYC Approvals</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input 
            className="pl-9" 
            placeholder="Search by Vendor ID, Name or Email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
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
                <TableHead>Vendor ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : vendors.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No vendors found matching criteria.</TableCell></TableRow>
              ) : (
                vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-mono text-xs">{vendor.vendor_id || '---'}</TableCell>
                    <TableCell className="font-medium">{vendor.company_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{vendor.owner_name}</div>
                      <div className="text-xs text-gray-500">{vendor.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        vendor.kyc_status === 'VERIFIED' ? 'success' : 
                        vendor.kyc_status === 'REJECTED' ? 'destructive' : 'secondary'
                      } className={
                        vendor.kyc_status === 'VERIFIED' ? 'bg-green-100 text-green-800' : 
                        vendor.kyc_status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }>
                        {vendor.kyc_status === 'VERIFIED' ? 'Approved' : vendor.kyc_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        {vendor.products?.[0]?.count || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDocs(vendor)}>
                          <Eye className="w-4 h-4 mr-1" /> Review
                        </Button>
                        {vendor.kyc_status === 'PENDING' && (
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
