import React, { useEffect, useMemo, useState } from "react";

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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

import {
  User,
  Eye,
  Edit,
  Loader2,
  Mail,
  Phone,
  Search,
  Building2,
  MapPin,
} from "lucide-react";
import { supabase } from "@/lib/customSupabaseClient";

/* ================= VALIDATION HELPERS ================= */
const nameRegex = /^[A-Za-z\s]+$/;
const phoneRegex = /^[6-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const pincodeRegex = /^\d{6}$/;

export default function Buyers() {
  const { toast } = useToast();

  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  /* ================= LOAD BUYERS ================= */
  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buyers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      let list = data || [];
      const t = searchTerm.trim().toLowerCase();
      if (t) {
        list = list.filter(
          (b) =>
            b.full_name?.toLowerCase().includes(t) ||
            b.email?.toLowerCase().includes(t) ||
            b.phone?.toLowerCase().includes(t) ||
            b.company_name?.toLowerCase().includes(t)
        );
      }
      setBuyers(list);
    } catch (e) {
      toast({
        title: "Error",
        description: e.message || "Failed to load buyers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(() => buyers.length, [buyers]);

  /* ================= VIEW / EDIT ================= */
  const openView = (b) => {
    setSelectedBuyer({ ...b }); // 🔥 IMPORTANT clone
    setShowViewModal(true);
  };

  const openEdit = (b) => {
    setSelectedBuyer({ ...b });
    setShowEditModal(true);
  };

  /* ================= SAVE BUYER ================= */
  const saveBuyer = async () => {
    const b = selectedBuyer;

    if (!b.full_name || !nameRegex.test(b.full_name)) {
      return toast({
        title: "Invalid Name",
        description: "Name should contain only letters",
        variant: "destructive",
      });
    }

    if (!emailRegex.test(b.email)) {
      return toast({
        title: "Invalid Email",
        description: "Enter valid email address",
        variant: "destructive",
      });
    }

    if (b.phone && !phoneRegex.test(b.phone)) {
      return toast({
        title: "Invalid Phone",
        description: "Enter valid 10-digit Indian mobile number",
        variant: "destructive",
      });
    }

    if (b.pan_card && !panRegex.test(b.pan_card)) {
      return toast({
        title: "Invalid PAN",
        description: "PAN format: ABCDE1234F",
        variant: "destructive",
      });
    }

    if (b.gst_number && !gstRegex.test(b.gst_number)) {
      return toast({
        title: "Invalid GST",
        description: "GST format is invalid",
        variant: "destructive",
      });
    }

    if (b.pincode && !pincodeRegex.test(b.pincode)) {
      return toast({
        title: "Invalid Pincode",
        description: "Pincode must be 6 digits",
        variant: "destructive",
      });
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("buyers")
        .update({
          full_name: b.full_name.trim(),
          phone: b.phone || null,
          company_name: b.company_name || null,
          address: b.address || null,
          city: b.city || null,
          state: b.state || null,
          pincode: b.pincode || null,
          pan_card: b.pan_card || null,
          gst_number: b.gst_number || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", b.id);

      if (error) throw error;

      toast({ title: "Success", description: "Buyer updated successfully" });
      setShowEditModal(false);
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e.message || "Update failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Buyer Management</h1>
          <p className="text-gray-500">Registered buyers and profile details</p>
        </div>
        <Badge variant="outline">{total} Total Buyers</Badge>
      </div>

      {/* Search */}
      <div className="p-4 bg-white border rounded">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, phone or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto h-6 w-6" />
                  </TableCell>
                </TableRow>
              ) : buyers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No buyers found
                  </TableCell>
                </TableRow>
              ) : (
                buyers.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.full_name}</TableCell>
                    <TableCell>{b.email}</TableCell>
                    <TableCell>{b.company_name || "Individual"}</TableCell>
                    <TableCell>
                      {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openView(b)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={() => openEdit(b)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* VIEW MODAL */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buyer Details</DialogTitle>
          </DialogHeader>

          {selectedBuyer && (
            <div className="space-y-2 text-sm">
              <div><b>Name:</b> {selectedBuyer.full_name}</div>
              <div><b>Email:</b> {selectedBuyer.email}</div>
              <div><b>Phone:</b> {selectedBuyer.phone || "—"}</div>
              <div><b>Company:</b> {selectedBuyer.company_name || "Individual"}</div>
              <div><b>PAN:</b> {selectedBuyer.pan_card || "—"}</div>
              <div><b>GST:</b> {selectedBuyer.gst_number || "—"}</div>
              <div><b>Address:</b> {selectedBuyer.address || "—"}</div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Buyer</DialogTitle>
          </DialogHeader>

          {selectedBuyer && (
            <div className="space-y-3">
              <Input
                value={selectedBuyer.full_name}
                onChange={(e) =>
                  setSelectedBuyer({
                    ...selectedBuyer,
                    full_name: e.target.value.replace(/[^A-Za-z\s]/g, ""),
                  })
                }
                placeholder="Full Name"
              />
              <Input
                value={selectedBuyer.phone || ""}
                onChange={(e) =>
                  setSelectedBuyer({
                    ...selectedBuyer,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                placeholder="Phone"
              />
              <Input
                value={selectedBuyer.company_name || ""}
                onChange={(e) =>
                  setSelectedBuyer({ ...selectedBuyer, company_name: e.target.value })
                }
                placeholder="Company"
              />
              <Input
                value={selectedBuyer.pan_card || ""}
                onChange={(e) =>
                  setSelectedBuyer({
                    ...selectedBuyer,
                    pan_card: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 10),
                  })
                }
                placeholder="PAN (ABCDE1234F)"
              />
              <Input
                value={selectedBuyer.gst_number || ""}
                onChange={(e) =>
                  setSelectedBuyer({
                    ...selectedBuyer,
                    gst_number: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 15),
                  })
                }
                placeholder="GST Number"
              />
              <Textarea
                value={selectedBuyer.address || ""}
                onChange={(e) =>
                  setSelectedBuyer({ ...selectedBuyer, address: e.target.value })
                }
                placeholder="Address"
              />
              <Input
                value={selectedBuyer.city || ""}
                onChange={(e) =>
                  setSelectedBuyer({ ...selectedBuyer, city: e.target.value })
                }
                placeholder="City"
              />
              <Input
                value={selectedBuyer.state || ""}
                onChange={(e) =>
                  setSelectedBuyer({ ...selectedBuyer, state: e.target.value })
                }
                placeholder="State"
              />
              <Input
                value={selectedBuyer.pincode || ""}
                onChange={(e) =>
                  setSelectedBuyer({
                    ...selectedBuyer,
                    pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                  })
                }
                placeholder="Pincode"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveBuyer} disabled={processing}>
              {processing && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}