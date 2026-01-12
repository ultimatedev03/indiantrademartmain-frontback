
import React, { useEffect, useState } from 'react';
import { useEmployeeAuth } from '@/modules/employee/context/EmployeeAuthContext';
import { dataEntryApi } from '@/modules/employee/services/dataEntryApi';
import { notificationService } from '@/modules/employee/services/notificationService';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Check, X, FileText, ExternalLink, AlertCircle } from 'lucide-react';

const KycApprovals = () => {
    const { user } = useEmployeeAuth();
    const [vendorsWithDocs, setVendorsWithDocs] = useState([]);
    const [vendorsWithoutDocs, setVendorsWithoutDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Dialog states
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [docs, setDocs] = useState([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        loadVendors();
    }, [user]);

    const loadVendors = async () => {
        if(!user) return;
        setLoading(true);
        try {
            const { withDocuments, withoutDocuments } = await dataEntryApi.getVendorsGroupedByKycDocuments();
            setVendorsWithDocs(withDocuments || []);
            setVendorsWithoutDocs(withoutDocuments || []);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to load pending KYC vendors", variant: "destructive" });
            setVendorsWithDocs([]);
            setVendorsWithoutDocs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDocs = async (vendor) => {
        setSelectedVendor(vendor);
        setIsLoadingDocs(true);
        try {
            const documents = await dataEntryApi.getVendorDocuments(vendor.id);
            setDocs(documents || []);
        } catch (error) {
            toast({ title: "Error", description: "Failed to load documents" });
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedVendor) return;
        // eslint-disable-next-line no-restricted-globals
        if (!window.confirm(`Approve KYC for ${selectedVendor.company_name}?`)) return;

        try {
            await dataEntryApi.approveVendorKyc(selectedVendor.id);
            
            // Send notification to all DATA_ENTRY employees
            await notificationService.sendNotificationToRole(
                'DATA_ENTRY',
                'KYC_APPROVED',
                'KYC Approved',
                `Vendor "${selectedVendor.company_name}" (${selectedVendor.vendor_id}) KYC has been approved.`
            );
            
            toast({ title: "Approved", description: "Vendor KYC has been verified. Notifications sent to data entry team." });
            setSelectedVendor(null);
            loadVendors(); // Refresh list
        } catch (error) {
            toast({ title: "Error", description: "Failed to approve vendor", variant: "destructive" });
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectReason) return;
        try {
            await dataEntryApi.rejectVendorKyc(selectedVendor.id, rejectReason);
            
            // Send notification to all DATA_ENTRY employees
            await notificationService.sendNotificationToRole(
                'DATA_ENTRY',
                'KYC_REJECTED',
                'KYC Rejected',
                `Vendor "${selectedVendor.company_name}" (${selectedVendor.vendor_id}) KYC has been rejected.`
            );
            
            toast({ title: "Rejected", description: "Vendor KYC rejected and remarks sent. Notifications sent to data entry team." });
            setIsRejectDialogOpen(false);
            setSelectedVendor(null);
            setRejectReason("");
            loadVendors();
        } catch (error) {
            toast({ title: "Error", description: "Failed to reject vendor", variant: "destructive" });
        }
    };

    const VendorTable = ({ vendors, title, emptyMessage, variant = 'default' }) => (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {variant === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vendor ID</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Submitted On</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vendors.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">{emptyMessage}</TableCell></TableRow>
                            ) : (
                                vendors.map(v => (
                                    <TableRow key={v.id}>
                                        <TableCell className="font-mono text-xs">{v.vendor_id}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{v.company_name}</div>
                                            <div className="text-xs text-gray-500">{v.owner_name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={v.kyc_status === 'VERIFIED' ? 'success' : v.kyc_status === 'REJECTED' ? 'destructive' : 'warning'}>
                                                {v.kyc_status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => handleViewDocs(v)}>
                                                Review
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-neutral-800">KYC Approvals</h1>
                {user?.role === 'ADMIN' && <Badge variant="outline">Admin View</Badge>}
            </div>

            <VendorTable
                vendors={vendorsWithDocs}
                title="Vendors with Documents"
                emptyMessage="No vendors with submitted documents."
                variant="default"
            />

            <VendorTable
                vendors={vendorsWithoutDocs}
                title="Vendors Awaiting Documents"
                emptyMessage="No vendors awaiting documents."
                variant="warning"
            />

            {/* Review Dialog */}
            <Dialog open={!!selectedVendor && !isRejectDialogOpen} onOpenChange={(open) => !open && setSelectedVendor(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Review KYC: {selectedVendor?.company_name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-6 py-4">
                        <div>
                            <h4 className="font-semibold mb-2">Vendor Details</h4>
                            <div className="space-y-2 text-sm">
                                <p><span className="text-gray-500">ID:</span> {selectedVendor?.vendor_id}</p>
                                <p><span className="text-gray-500">Email:</span> {selectedVendor?.email}</p>
                                <p><span className="text-gray-500">Phone:</span> {selectedVendor?.phone}</p>
                                <p><span className="text-gray-500">Address:</span> {selectedVendor?.address || 'N/A'}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Documents</h4>
                            {isLoadingDocs ? <Loader2 className="animate-spin" /> : docs.length === 0 ? (
                                <p className="text-sm text-red-500 italic">No documents uploaded yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {docs.map((doc, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 border rounded bg-gray-50">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-500" />
                                                <div>
                                                    <span className="text-sm font-medium block">{doc.document_type}</span>
                                                    <span className="text-xs text-gray-500">{doc.original_name || 'Document'}</span>
                                                </div>
                                            </div>
                                            <a href={doc.document_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                View <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)}>
                            <X className="w-4 h-4 mr-2" /> Reject
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                            <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject KYC Application</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Reason for Rejection *</label>
                        <Textarea 
                            value={rejectReason} 
                            onChange={(e) => setRejectReason(e.target.value)} 
                            placeholder="Please explain why the KYC is being rejected..."
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRejectSubmit} disabled={!rejectReason}>Confirm Rejection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default KycApprovals;
