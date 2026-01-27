import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  FolderKanban,
  Package,
  Layers,
  Plus,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const Collections = () => {
  const [vendorId, setVendorId] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customGroups, setCustomGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupNote, setNewGroupNote] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [productForGroup, setProductForGroup] = useState('');
  const [groupMode, setGroupMode] = useState('custom'); // custom | head | sub | micro | category

  // ---------------- helpers ----------------
  const fetchVendorId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (vendor?.id) setVendorId(vendor.id);
    } catch (e) {
      console.error('Vendor fetch failed', e);
    }
  };

  const loadProducts = async (vid) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, is_service, metadata, status')
        .eq('vendor_id', vid)
        .neq('status', 'ARCHIVED')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
      // preload existing custom groups from metadata
      const groups = new Set();
      (data || []).forEach((p) => {
        const g = p?.metadata?.custom_group;
        if (g) groups.add(g);
      });
      setCustomGroups(Array.from(groups));
    } catch (e) {
      console.error('Products load failed', e);
      toast({ title: 'Error', description: 'Could not load products', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorId();
  }, []);

  useEffect(() => {
    if (vendorId) loadProducts(vendorId);
  }, [vendorId]);

  const grouped = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      let grp = 'Uncategorized';
      if (groupMode === 'head' && p.head_category_id && p.head_category_name) {
        grp = `Head: ${p.head_category_name}`;
      } else if (groupMode === 'sub' && p.sub_category_id && p.sub_category_name) {
        grp = `Sub: ${p.sub_category_name}`;
      } else if (groupMode === 'micro' && p.micro_category_id && p.micro_category_name) {
        grp = `Micro: ${p.micro_category_name}`;
      } else if (groupMode === 'category' && p.category) {
        grp = `Category: ${p.category}`;
      } else {
        grp =
          (p.metadata && p.metadata.custom_group) ||
          (p.category ? `Category: ${p.category}` : p.is_service ? 'Services' : 'Uncategorized');
      }

      if (!map[grp]) map[grp] = [];
      map[grp].push(p);
    });
    return map;
  }, [products, groupMode]);

  const createCustomGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: 'Enter a group name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Notify data-entry via support ticket
      if (vendorId) {
        await supabase.from('support_tickets').insert({
          vendor_id: vendorId,
          subject: `New category/group request: ${newGroupName.trim()}`,
          description:
            newGroupNote?.trim() ||
            'Vendor requested a custom category/group that does not exist yet.',
          category: 'Category Request',
          priority: 'Medium',
        });
      }
      setCustomGroups((prev) => Array.from(new Set([...prev, newGroupName.trim()])));
      toast({ title: 'Custom group created', description: 'We also notified data-entry to add this category.' });
      setNewGroupName('');
      setNewGroupNote('');
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: e?.message || 'Could not create group', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const assignToGroup = async () => {
    if (!productForGroup || !selectedGroup) {
      toast({ title: 'Select product & group first', variant: 'destructive' });
      return;
    }
    setAssigning(true);
    try {
      const product = products.find((p) => p.id === productForGroup);
      const currentMeta = product?.metadata || {};
      const updatedMeta = { ...currentMeta, custom_group: selectedGroup };
      const { error } = await supabase
        .from('products')
        .update({ metadata: updatedMeta })
        .eq('id', productForGroup);
      if (error) throw error;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productForGroup ? { ...p, metadata: updatedMeta } : p
        )
      );
      toast({ title: 'Assigned', description: 'Product moved to the selected group.' });
      setProductForGroup('');
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: e?.message || 'Could not assign product', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-slate-600">
        Loading collections...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FolderKanban className="w-8 h-8 text-[#003D82]" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Collections</h1>
          <p className="text-slate-600 text-sm">
            1) Group products/services by category for better management. 2) Create a custom group if a category is missing – we’ll notify data-entry to add it.
          </p>
        </div>
      </div>

      {/* Custom group creator */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#003D82]" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create Custom Group</h2>
            <p className="text-sm text-slate-600">
              Use this when the needed category doesn’t exist. A notification will be sent to data-entry.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Group name (e.g., Solar Accessories)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Input
            placeholder="Note for data-entry (optional)"
            value={newGroupNote}
            onChange={(e) => setNewGroupNote(e.target.value)}
          />
        </div>
        <Button onClick={createCustomGroup} disabled={saving}>
          {saving ? 'Saving...' : 'Create & Notify'}
          <Send className="w-4 h-4 ml-2" />
        </Button>
        {customGroups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customGroups.map((g) => (
              <Badge key={g} variant="secondary" className="px-3 py-1">{g}</Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Assign products to custom group */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Assign Product to Custom Group</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className="border rounded-lg px-3 py-2"
            value={productForGroup}
            onChange={(e) => setProductForGroup(e.target.value)}
          >
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-2"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">Select a custom group</option>
            {customGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <Button onClick={assignToGroup} disabled={assigning || !productForGroup || !selectedGroup}>
            {assigning ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Assigned group is stored in product metadata, so grouping sticks even after reload.
        </p>
      </Card>

      {/* Existing grouped view */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Grouped Products/Services</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-slate-600">Group by:</span>
          {[
            { key: 'custom', label: 'Custom/Category (default)' },
            { key: 'head', label: 'Head Category' },
            { key: 'sub', label: 'Sub Category' },
            { key: 'micro', label: 'Micro Category' },
            { key: 'category', label: 'Text Category' },
          ].map((opt) => (
            <Button
              key={opt.key}
              variant={groupMode === opt.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupMode(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {Object.keys(grouped).length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <AlertCircle className="w-4 h-4" /> No products yet.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([groupName, list]) => (
              <div key={groupName} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-700" />
                    <h3 className="font-semibold text-slate-900">{groupName}</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">{list.length} item(s)</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {list.map((p) => (
                    <div key={p.id} className="border rounded-lg px-3 py-2 bg-slate-50">
                      <div className="font-semibold text-slate-900 text-sm line-clamp-1">{p.name}</div>
                      <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                        <span className="uppercase text-[10px] px-1.5 py-0.5 bg-slate-200 rounded">{p.status}</span>
                        {p.metadata?.custom_group && (
                          <span className="text-emerald-700 text-[11px]">Custom: {p.metadata.custom_group}</span>
                        )}
                        {p.category && groupMode !== 'category' && (
                          <span className="text-blue-700 text-[11px]">Cat: {p.category}</span>
                        )}
                        {p.head_category_name && groupMode !== 'head' && (
                          <span className="text-purple-700 text-[11px]">Head: {p.head_category_name}</span>
                        )}
                        {p.sub_category_name && groupMode !== 'sub' && (
                          <span className="text-orange-700 text-[11px]">Sub: {p.sub_category_name}</span>
                        )}
                        {p.micro_category_name && groupMode !== 'micro' && (
                          <span className="text-rose-700 text-[11px]">Micro: {p.micro_category_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Collections;
