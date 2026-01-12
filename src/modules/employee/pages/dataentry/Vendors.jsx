
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Eye, Search, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Vendors = () => {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredVendors, setFilteredVendors] = useState([]);
    const [vendorIdSearch, setVendorIdSearch] = useState('');

    useEffect(() => {
        loadVendors();
    }, []);

    const loadVendors = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .eq('is_active', true)
                .order('company_name');

            if (error) throw error;
            setVendors(data || []);
            setFilteredVendors(data || []);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setFilteredVendors(vendors);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = vendors.filter(v => 
            v.company_name?.toLowerCase().includes(lowerQuery) ||
            v.owner_name?.toLowerCase().includes(lowerQuery) ||
            v.vendor_id?.toLowerCase().includes(lowerQuery) ||
            v.email?.toLowerCase().includes(lowerQuery)
        );
        setFilteredVendors(filtered);
    };

    const handleVendorIdSearch = async () => {
        if (!vendorIdSearch.trim()) {
            toast({ title: "Error", description: "Please enter a vendor ID", variant: "destructive" });
            return;
        }

        const vendor = vendors.find(v => v.vendor_id?.toLowerCase() === vendorIdSearch.toLowerCase());
        if (vendor) {
            navigate(`/employee/dataentry/vendors/${vendor.id}/products`);
        } else {
            toast({ title: "Not Found", description: `Vendor ID "${vendorIdSearch}" not found`, variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold mb-2">Vendor Management</h1>
                <p className="text-gray-600">View and manage all vendors</p>
            </div>

            {/* Vendor ID Quick Search */}
            <Card className="bg-blue-50 border-blue-200">
                <CardHeader><CardTitle className="text-lg">Quick Vendor Lookup</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Enter Vendor ID (e.g., VEN-001)"
                            value={vendorIdSearch}
                            onChange={e => setVendorIdSearch(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleVendorIdSearch()}
                        />
                        <Button onClick={handleVendorIdSearch} className="gap-1">
                            <Search className="w-4 h-4" />
                            Search
                        </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">Type a vendor ID and press Enter or click Search to quickly navigate to their products</p>
                </CardContent>
            </Card>

            {/* Vendor List */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>All Vendors ({filteredVendors.length})</CardTitle>
                    </div>
                    <div className="mt-4">
                        <Input 
                            placeholder="Search by company name, owner, vendor ID, or email..."
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            className="max-w-md"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : filteredVendors.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>No vendors found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vendor ID</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Owner</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>KYC Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredVendors.map(v => (
                                        <TableRow key={v.id}>
                                            <TableCell className="font-mono font-semibold">{v.vendor_id}</TableCell>
                                            <TableCell className="font-medium">{v.company_name}</TableCell>
                                            <TableCell>{v.owner_name}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{v.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={v.kyc_status === 'VERIFIED' ? 'default' : v.kyc_status === 'REJECTED' ? 'destructive' : 'secondary'}>
                                                    {v.kyc_status || 'PENDING'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link to={`/employee/dataentry/vendors/${v.id}/products`}>
                                                    <Button size="sm" variant="outline" className="gap-1">
                                                        <Eye className="w-4 h-4" />
                                                        View Products
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
export default Vendors;
