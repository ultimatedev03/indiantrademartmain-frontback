import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, PhoneCall, RefreshCw, Send } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { territoryApi } from '@/modules/employee/services/territoryApi';

const Leads = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [vendors, setVendors] = useState([]);
  const [meta, setMeta] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await territoryApi.getSalesVendors({
        search: searchTerm,
        limit: 300,
      });
      setVendors(data?.vendors || []);
      setMeta(data?.meta || {});
    } catch (error) {
      toast({
        title: 'Failed to load masked vendors',
        description: error?.message || 'Unable to fetch territory vendors',
        variant: 'destructive',
      });
      setVendors([]);
      setMeta({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const logEngagement = async (vendorId, engagementType, divisionId = null) => {
    try {
      setSavingId(`${vendorId}:${engagementType}`);
      await territoryApi.createEngagement({
        vendor_id: vendorId,
        division_id: divisionId || undefined,
        engagement_type: engagementType,
        status: 'OPEN',
      });
      toast({ title: `${engagementType} logged` });
    } catch (error) {
      toast({
        title: 'Failed to log engagement',
        description: error?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Territory Vendor Prospects</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Contact data is masked by design. Only your allocated territory vendors are visible.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Input
              placeholder="Search company / owner / city / pincode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Masked Vendor List</CardTitle>
          <Badge variant="outline">
            {meta?.total || vendors.length} vendors • {meta?.divisions_in_scope || 0} divisions
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No vendors found in your current allocation scope.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact (Masked)</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="font-medium">{vendor.company_name || '—'}</div>
                      <div className="text-xs text-slate-500">{vendor.vendor_id || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{vendor.owner_name || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{vendor.phone || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{vendor.email || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{vendor.division_name || '—'}</div>
                      <div className="text-xs text-slate-500">
                        {[vendor.division_city || vendor.city, vendor.division_state || vendor.state].filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        Division pincodes: {vendor.division_pincode_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{[vendor.city, vendor.state].filter(Boolean).join(', ') || '—'}</div>
                      <div className="text-xs text-slate-500">Pincode: {vendor.pincode || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vendor.kyc_status || 'PENDING'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === `${vendor.id}:CALL`}
                          onClick={() => logEngagement(vendor.id, 'CALL', vendor.division_id)}
                        >
                          {savingId === `${vendor.id}:CALL` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PhoneCall className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          disabled={savingId === `${vendor.id}:PLAN_PITCH`}
                          onClick={() => logEngagement(vendor.id, 'PLAN_PITCH', vendor.division_id)}
                        >
                          {savingId === `${vendor.id}:PLAN_PITCH` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;
