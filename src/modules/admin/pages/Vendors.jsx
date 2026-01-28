import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import {
  Building2,
  Eye,
  Filter,
  Loader2,
  Mail,
  Phone,
  Package,
  Search,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";

// ✅ Local vs Netlify API base
const isLocalHost = () => {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
};
const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? "/api/admin" : "/.netlify/functions/admin";
};
async function safeReadJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  throw new Error(
    `API returned non-JSON (${res.status}). Got: ${text.slice(0, 80)}...`
  );
}

const norm = (v) => String(v || "").toUpperCase();

const kycBadgeClass = (s) => {
  const v = norm(s || "PENDING");
  const map = {
    APPROVED: "bg-green-100 text-green-800",
    VERIFIED: "bg-green-100 text-green-800",
    SUBMITTED: "bg-yellow-100 text-yellow-800",
    PENDING: "bg-gray-100 text-gray-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return map[v] || "bg-gray-100 text-gray-800";
};

export default function Vendors() {
  const { toast } = useToast();
  const ADMIN_API_BASE = getAdminBase();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterKyc, setFilterKyc] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const isTerminationReasonValid = useMemo(
    () => terminationReason.trim().length > 0,
    [terminationReason]
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/vendors`);
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Failed");

      let list = data.vendors || [];

      // filters
      if (filterKyc !== "all") {
        const map = {
          pending: "PENDING",
          submitted: "SUBMITTED",
          approved: "APPROVED",
          rejected: "REJECTED",
        };
        const want = map[filterKyc] || filterKyc.toUpperCase();
        list = list.filter((v) => norm(v.kyc_status) === want);
      }

      if (filterActive !== "all") {
        const want = filterActive === "active";
        list = list.filter((v) => (v.is_active !== false) === want);
      }

      const t = searchTerm.trim().toLowerCase();
      if (t) {
        list = list.filter(
          (v) =>
            v.company_name?.toLowerCase().includes(t) ||
            v.owner_name?.toLowerCase().includes(t) ||
            v.vendor_id?.toLowerCase().includes(t) ||
            v.email?.toLowerCase().includes(t)
        );
      }

      setVendors(list);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Failed to load vendors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKyc, filterActive]);

  const total = useMemo(() => vendors.length, [vendors]);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  const openVendor = (v) => {
    setSelectedVendor(v);
    setShowVendorModal(true);
  };

  const openTerminate = (v) => {
    setSelectedVendor(v);
    setTerminationReason("");
    setShowTerminateModal(true);
  };

  const doTerminate = async () => {
    if (!selectedVendor?.id) return;

    // ✅ REQUIRED reason for terminate
    const reason = terminationReason.trim();
    if (!reason) {
      toast({
        title: "Reason required",
        description: "Please type a reason to terminate this vendor.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetchWithCsrf(
        `${ADMIN_API_BASE}/vendors/${selectedVendor.id}/terminate`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Terminate failed");
      toast({ title: "Success", description: "Vendor terminated" });
      setShowTerminateModal(false);
      setTerminationReason("");
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Terminate failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const doActivate = async (vendorId) => {
    setProcessing(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/vendors/${vendorId}/activate`, {
        method: "POST",
      });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Activate failed");
      toast({ title: "Success", description: "Vendor activated" });
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Activate failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">
            Vendor Management
          </h1>
          <p className="text-gray-500">
            Vendor details, package, products and termination
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {total} Total Vendors
        </Badge>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-lg border">
        <form onSubmit={onSearch} className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            className="pl-9"
            placeholder="Search by company, owner, vendor id or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        <Select value={filterKyc} onValueChange={setFilterKyc}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="KYC Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All KYC</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[200px]">
            <ShieldCheck className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Vendor Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner / Contact</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto h-6 w-6 text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((v) => {
                  const active = v.is_active !== false;
                  const planName = v.package?.plan_name || "FREE";
                  const planPrice = Number(v.package?.price || 0);

                  return (
                    <TableRow key={v.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{v.company_name || "—"}</p>
                            <p className="text-xs text-gray-500">{v.vendor_id || "Business"}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-medium">{v.owner_name || "—"}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="break-all">{v.email || "—"}</span>
                        </div>
                        {v.phone ? (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {v.phone}
                          </div>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <Badge className={kycBadgeClass(v.kyc_status)}>
                          {norm(v.kyc_status || "PENDING")}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {planName} {planPrice ? `• ₹${planPrice}` : ""}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {v.product_count || 0}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-gray-500">
                        {v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={
                            active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {active ? "ACTIVE" : "TERMINATED"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openVendor(v)}>
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>

                          <Link to={`/admin/vendors/${v.id}/products`}>
                            <Button variant="outline" size="sm">
                              <Package className="w-4 h-4 mr-1" /> Products
                            </Button>
                          </Link>

                          {active ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openTerminate(v)}
                              disabled={processing}
                              title="Terminate vendor"
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => doActivate(v.id)}
                              disabled={processing}
                              title="Activate vendor"
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendor Details Modal */}
      <Dialog open={showVendorModal} onOpenChange={setShowVendorModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>Package and status details</DialogDescription>
          </DialogHeader>

          {selectedVendor ? (
            <div className="space-y-3 text-sm">
              <div className="font-semibold">{selectedVendor.company_name}</div>
              <div>
                Owner:{" "}
                <span className="font-medium">{selectedVendor.owner_name || "—"}</span>
              </div>
              <div>
                Email:{" "}
                <span className="font-medium">{selectedVendor.email || "—"}</span>
              </div>
              <div>
                Phone:{" "}
                <span className="font-medium">{selectedVendor.phone || "—"}</span>
              </div>
              <div>
                Package:{" "}
                <Badge variant="outline" className="font-medium">
                  {selectedVendor.package?.plan_name || "FREE"}{" "}
                  {Number(selectedVendor.package?.price || 0)
                    ? `• ₹${selectedVendor.package?.price}`
                    : ""}
                </Badge>
              </div>
              <div>
                Status:{" "}
                <Badge
                  className={
                    selectedVendor.is_active !== false
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {selectedVendor.is_active !== false ? "ACTIVE" : "TERMINATED"}
                </Badge>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVendorModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Modal */}
      <Dialog
        open={showTerminateModal}
        onOpenChange={(open) => {
          setShowTerminateModal(open);
          if (!open) setTerminationReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Terminate Vendor</DialogTitle>
            <DialogDescription>
              Vendor will be deactivated (is_active=false)
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Reason (required)"
            value={terminationReason}
            onChange={(e) => setTerminationReason(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-gray-500">
            Please type a reason to enable <b>Terminate</b>.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerminateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={doTerminate}
              disabled={processing || !isTerminationReasonValid}
            >
              {processing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
