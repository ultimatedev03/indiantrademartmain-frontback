import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { Loader2, ArrowLeft, Image as ImageIcon, Eye, Pencil, Trash2 } from "lucide-react";

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
  throw new Error(`API returned non-JSON (${res.status}). Got: ${text.slice(0, 80)}...`);
}

const money = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n}`;
};

// ✅ Combine images from product_images table + products.images jsonb
const getProductImageUrls = (p) => {
  const urls = [];

  // product_images (array of rows)
  if (Array.isArray(p?.product_images)) {
    p.product_images.forEach((img) => {
      if (img?.image_url) urls.push(img.image_url);
    });
  }

  // products.images (jsonb) -> can be array of strings or objects
  const imgs = p?.images;
  if (Array.isArray(imgs)) {
    imgs.forEach((it) => {
      if (typeof it === "string" && it.trim()) urls.push(it.trim());
      else if (it && typeof it === "object") {
        if (typeof it.url === "string" && it.url.trim()) urls.push(it.url.trim());
        else if (typeof it.image_url === "string" && it.image_url.trim()) urls.push(it.image_url.trim());
        else if (typeof it.path === "string" && it.path.trim()) urls.push(it.path.trim());
      }
    });
  }

  // Remove duplicates
  return Array.from(new Set(urls));
};

const priceWithUnit = (p) => {
  const unit = p?.price_unit || p?.qty_unit || "";
  const base = money(p?.price);
  return unit ? `${base} / ${unit}` : base;
};

export default function VendorProducts() {
  const { toast } = useToast();
  const ADMIN_API_BASE = getAdminBase();
  const { vendorId } = useParams();

  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewProduct, setViewProduct] = useState(null);
  const [openView, setOpenView] = useState(false);

  const [editProduct, setEditProduct] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_API_BASE}/vendors/${vendorId}/products`);
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Failed");
      setVendor(data.vendor || null);
      setProducts(data.products || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const openViewModal = (p) => {
    setViewProduct(p);
    setOpenView(true);
  };

  const openEditModal = (p) => {
    setEditProduct({
      id: p.id,
      name: p.name || "",
      description: p.description || "",
      price: p.price ?? 0,
      price_unit: p.price_unit || "",
      status: p.status || "DRAFT",
      moq: p.moq ?? 1,
      stock: p.stock ?? 0,
      is_service: !!p.is_service,
    });
    setOpenEdit(true);
  };

  const saveEdit = async () => {
    if (!editProduct?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`${ADMIN_API_BASE}/products/${editProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProduct.name,
          description: editProduct.description,
          price: Number(editProduct.price || 0),
          price_unit: editProduct.price_unit || null,
          status: editProduct.status,
          moq: Number(editProduct.moq || 1),
          stock: Number(editProduct.stock || 0),
          is_service: !!editProduct.is_service,
        }),
      });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Update failed");

      toast({ title: "Success", description: "Product updated" });
      setOpenEdit(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Update failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (p) => {
    const ok = window.confirm(`Delete product: ${p.name}?`);
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`${ADMIN_API_BASE}/products/${p.id}`, { method: "DELETE" });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Delete failed");
      toast({ title: "Success", description: "Product deleted" });
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Delete failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/vendors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-neutral-800">
            {vendor?.company_name ? `${vendor.company_name} Products` : "Vendor Products"}
          </h1>
          <p className="text-sm text-gray-500">Admin can view/update/delete products</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">{products.length} Products</Badge>
          {vendor?.is_active === false ? <Badge variant="destructive">TERMINATED</Badge> : <Badge variant="outline">ACTIVE</Badge>}
        </div>
      </div>

      {vendor ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="font-medium">{vendor.company_name}</div>
                <div className="text-gray-500">{vendor.vendor_id}</div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-700">Owner: <span className="font-medium">{vendor.owner_name || "—"}</span></div>
                <div className="text-gray-700">Email: <span className="font-medium break-all">{vendor.email || "—"}</span></div>
                <div className="text-gray-700">Phone: <span className="font-medium">{vendor.phone || "—"}</span></div>
                <div className="text-gray-700">KYC: <span className="font-medium">{String(vendor.kyc_status || "PENDING").toUpperCase()}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No products found for this vendor.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const urls = getProductImageUrls(p);
                const firstImage = urls[0] || null;

                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                        {firstImage ? (
                          <img src={firstImage} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{priceWithUnit(p)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{p.status || "DRAFT"}</Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openViewModal(p)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditModal(p)} disabled={saving}>
                          <Pencil className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteProduct(p)} disabled={saving}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Modal */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>{viewProduct?.name || ""}</DialogDescription>
          </DialogHeader>

          {viewProduct ? (
            <div className="space-y-4">
              <div className="text-sm">
                <div><span className="text-gray-500">Price:</span> <span className="font-medium">{priceWithUnit(viewProduct)}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium">{viewProduct.status || "DRAFT"}</span></div>
                <div className="break-words">
                  <span className="text-gray-500">Description:</span>{" "}
                  <span className="font-medium">{viewProduct.description || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {getProductImageUrls(viewProduct).slice(0, 12).map((url, i) => (
                  <div key={`${url}-${i}`} className="aspect-square bg-gray-100 rounded overflow-hidden">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {getProductImageUrls(viewProduct).length === 0 ? (
                  <div className="col-span-2 md:col-span-3 text-sm text-gray-500">No images uploaded.</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenView(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Admin can update product fields</DialogDescription>
          </DialogHeader>

          {editProduct ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <Input value={editProduct.name} onChange={(e) => setEditProduct((s) => ({ ...s, name: e.target.value }))} />
              </div>

              <div>
                <label className="text-sm text-gray-600">Description</label>
                <Textarea
                  rows={4}
                  value={editProduct.description}
                  onChange={(e) => setEditProduct((s) => ({ ...s, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Price</label>
                  <Input
                    type="number"
                    value={editProduct.price}
                    onChange={(e) => setEditProduct((s) => ({ ...s, price: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Price Unit</label>
                  <Input
                    placeholder="e.g. piece, unit, kg"
                    value={editProduct.price_unit}
                    onChange={(e) => setEditProduct((s) => ({ ...s, price_unit: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Stock</label>
                  <Input
                    type="number"
                    value={editProduct.stock}
                    onChange={(e) => setEditProduct((s) => ({ ...s, stock: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Status</label>
                <Select value={editProduct.status} onValueChange={(v) => setEditProduct((s) => ({ ...s, status: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                    <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
