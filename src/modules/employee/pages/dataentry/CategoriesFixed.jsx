import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Tag, Search, X } from 'lucide-react';
import AddEditCategoryDialog from '@/modules/employee/components/AddEditCategoryDialog';
import DeleteCategoryDialog from '@/modules/employee/components/DeleteCategoryDialog';
import { headCategoryApi, subCategoryApi, microCategoryApi } from '@/modules/employee/services/categoryApi';

const CategoriesFixed = () => {
  // State for head categories
  const [headCategories, setHeadCategories] = useState([]);
  const [expandedHeads, setExpandedHeads] = useState({});

  // State for sub categories
  const [subCategories, setSubCategories] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});

  // State for micro categories
  const [microCategories, setMicroCategories] = useState({});

  // State for micro category meta
  const [microMeta, setMicroMeta] = useState({});

  // State for dialogs
  const [selectedMicroCategory, setSelectedMicroCategory] = useState(null);
  const [showMetaDialog, setShowMetaDialog] = useState(false);
  const [metaData, setMetaData] = useState({ meta_tags: '', description: '', states: '', cities: '' });
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ heads: [], subs: [], micros: [] });

  const [loading, setLoading] = useState(false);

  // State for CRUD dialogs
  const [showAddEditDialog, setShowAddEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dialogLevel, setDialogLevel] = useState(null); // 'head', 'sub', 'micro'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [parentCategory, setParentCategory] = useState(null); // for sub/micro
  const [childCount, setChildCount] = useState(0);
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    fetchHeadCategories();
  }, []);

  // Fetch all head categories
  const fetchHeadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('head_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setHeadCategories(data || []);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch sub categories for a head category
  const fetchSubCategories = async (headCategoryId) => {
    try {
      const { data, error } = await supabase
        .from('sub_categories')
        .select('*')
        .eq('head_category_id', headCategoryId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSubCategories((prev) => ({ ...prev, [headCategoryId]: data || [] }));
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Fetch micro categories for a sub category
  const fetchMicroCategories = async (subCategoryId) => {
    try {
      const { data, error } = await supabase
        .from('micro_categories')
        .select('*')
        .eq('sub_category_id', subCategoryId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMicroCategories((prev) => ({ ...prev, [subCategoryId]: data || [] }));

      // Fetch meta for each micro category
      if (data && data.length > 0) {
        data.forEach((micro) => {
          fetchMicroMeta(micro.id);
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Fetch meta for micro category
  const fetchMicroMeta = async (microCategoryId) => {
    try {
      const { data, error } = await supabase
        .from('micro_category_meta')
        .select('*')
        .eq('micro_categories', microCategoryId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching meta:', error);
        // Don't throw - silently skip if RLS blocks it
        return;
      }
      setMicroMeta((prev) => ({ ...prev, [microCategoryId]: data || null }));
    } catch (error) {
      console.error('Error fetching meta:', error);
    }
  };

  // Search across all categories
  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults({ heads: [], subs: [], micros: [] });
      return;
    }

    const lowerQuery = query.toLowerCase();

    // Search in head categories
    const matchedHeads = headCategories.filter(
      (head) => head.name.toLowerCase().includes(lowerQuery) || head.slug.toLowerCase().includes(lowerQuery)
    );

    // Search in sub categories
    const matchedSubs = [];
    Object.entries(subCategories).forEach(([headId, subs]) => {
      subs.forEach((sub) => {
        if (sub.name.toLowerCase().includes(lowerQuery) || sub.slug.toLowerCase().includes(lowerQuery)) {
          matchedSubs.push({ ...sub, headCategoryId: headId });
        }
      });
    });

    // Search in micro categories
    const matchedMicros = [];
    Object.entries(microCategories).forEach(([subId, micros]) => {
      micros.forEach((micro) => {
        if (micro.name.toLowerCase().includes(lowerQuery) || micro.slug.toLowerCase().includes(lowerQuery)) {
          matchedMicros.push({ ...micro, subCategoryId: subId });
        }
      });
    });

    setSearchResults({
      heads: matchedHeads,
      subs: matchedSubs,
      micros: matchedMicros,
    });
  };

  // Toggle head category expansion
  const toggleHeadExpansion = (headId) => {
    if (expandedHeads[headId]) {
      setExpandedHeads((prev) => ({ ...prev, [headId]: false }));
    } else {
      setExpandedHeads((prev) => ({ ...prev, [headId]: true }));
      fetchSubCategories(headId);
    }
  };

  // Toggle sub category expansion
  const toggleSubExpansion = (subId) => {
    if (expandedSubs[subId]) {
      setExpandedSubs((prev) => ({ ...prev, [subId]: false }));
    } else {
      setExpandedSubs((prev) => ({ ...prev, [subId]: true }));
      fetchMicroCategories(subId);
    }
  };

  // Open meta dialog for micro category
  const openMetaDialog = (microCategory) => {
    setSelectedMicroCategory(microCategory);
    const meta = microMeta[microCategory.id];
    setMetaData({
      meta_tags: meta?.meta_tags || '',
      description: meta?.description || '',
    });
    setShowMetaDialog(true);
  };

  // Save meta tags and description
  const saveMeta = async () => {
    try {
      const existing = microMeta[selectedMicroCategory.id];

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('micro_category_meta')
          .update({
            meta_tags: metaData.meta_tags,
            description: metaData.description,
            updated_at: new Date().toISOString(),
          })
          .eq('micro_categories', selectedMicroCategory.id);

        if (error) {
          if (error.code === '42501') {
            toast({
              title: 'Permission Denied',
              description: 'RLS policy blocks this operation. Contact admin to fix permissions.',
              variant: 'destructive',
            });
          } else {
            throw error;
          }
          return;
        }
      } else {
        // Insert new
        const { error } = await supabase.from('micro_category_meta').insert([
          {
            micro_categories: selectedMicroCategory.id,
            meta_tags: metaData.meta_tags,
            description: metaData.description,
            created_at: new Date().toISOString(),
          },
        ]);

        if (error) {
          if (error.code === '42501') {
            toast({
              title: 'Permission Denied',
              description: 'RLS policy blocks this operation. Contact admin to fix permissions.',
              variant: 'destructive',
            });
          } else {
            throw error;
          }
          return;
        }
      }

      toast({ title: 'Success', description: 'Meta information saved' });
      setShowMetaDialog(false);
      fetchMicroMeta(selectedMicroCategory.id);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // CRUD Handlers
  const openAddDialog = (level, parentId = null, parentName = null) => {
    setDialogLevel(level);
    setSelectedCategory(null);
    setParentCategory(parentId ? { id: parentId, name: parentName } : null);
    setShowAddEditDialog(true);
  };

  const openEditDialog = async (level, category, parentId = null) => {
    setDialogLevel(level);
    setSelectedCategory(category);
    setParentCategory(parentId ? { id: parentId } : null);
    setShowAddEditDialog(true);
  };

  const openDeleteDialog = async (level, category, parentId = null) => {
    setDialogLevel(level);
    setSelectedCategory(category);
    setParentCategory(parentId ? { id: parentId } : null);

    // Get child count
    try {
      let count = 0;
      if (level === 'head') {
        count = await headCategoryApi.getChildCount(category.id);
      } else if (level === 'sub') {
        count = await subCategoryApi.getChildCount(category.id);
      }
      setChildCount(count);
    } catch (error) {
      console.error('Error getting child count:', error);
      setChildCount(0);
    }

    setShowDeleteDialog(true);
  };

  const handleSaveCategory = async (formData) => {
    if (savingCategory) return;
    setSavingCategory(true);

    try {
      if (dialogLevel === 'head') {
        if (formData.id) {
          await headCategoryApi.update(formData.id, formData);
          toast({ title: 'Success', description: 'Head category updated' });
        } else {
          await headCategoryApi.create(formData);
          toast({ title: 'Success', description: 'Head category created' });
        }
        await fetchHeadCategories();
      }

      if (dialogLevel === 'sub') {
        if (!formData.parentId) throw new Error('Head category required for sub category');
        if (formData.id) {
          await subCategoryApi.update(formData.id, formData);
          toast({ title: 'Success', description: 'Sub category updated' });
        } else {
          await subCategoryApi.create(formData, formData.parentId);
          toast({ title: 'Success', description: 'Sub category created' });
        }
        await fetchSubCategories(formData.parentId);
      }

      if (dialogLevel === 'micro') {
        if (!formData.parentId) throw new Error('Sub category required for micro category');
        if (formData.id) {
          await microCategoryApi.update(formData.id, formData);
          toast({ title: 'Success', description: 'Micro category updated' });
        } else {
          await microCategoryApi.create(formData, formData.parentId);
          toast({ title: 'Success', description: 'Micro category created' });
        }
        await fetchMicroCategories(formData.parentId);
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    try {
      if (dialogLevel === 'head') {
        await headCategoryApi.delete(selectedCategory.id);
        toast({ title: 'Success', description: 'Head category deleted' });
        await fetchHeadCategories();
      }

      if (dialogLevel === 'sub') {
        await subCategoryApi.delete(selectedCategory.id);
        toast({ title: 'Success', description: 'Sub category deleted' });
        await fetchSubCategories(parentCategory.id);
      }

      if (dialogLevel === 'micro') {
        await microCategoryApi.delete(selectedCategory.id);
        toast({ title: 'Success', description: 'Micro category deleted' });
        await fetchMicroCategories(parentCategory.id);
      }

      setShowDeleteDialog(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Expand/collapse logic for search navigation
  const navigateToCategory = (level, category) => {
    if (level === 'head') {
      toggleHeadExpansion(category.id);
    } else if (level === 'sub') {
      toggleHeadExpansion(category.headCategoryId);
      setTimeout(() => toggleSubExpansion(category.id), 500);
    } else if (level === 'micro') {
      // Find parent sub and head
      const parentSubId = category.subCategoryId;
      let parentHeadId = null;

      Object.entries(subCategories).forEach(([headId, subs]) => {
        if (subs.some((s) => s.id === parentSubId)) {
          parentHeadId = headId;
        }
      });

      if (parentHeadId) {
        toggleHeadExpansion(parentHeadId);
        setTimeout(() => {
          toggleSubExpansion(parentSubId);
        }, 500);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Category Management</h1>
          <p className="text-sm text-gray-500">Click on categories to expand and manage subcategories and meta information</p>
        </div>

        <Button onClick={() => openAddDialog('head')} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Head Category
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search head, sub, or micro categories..."
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              onClick={() => handleSearch('')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchQuery && (searchResults.heads.length || searchResults.subs.length || searchResults.micros.length) ? (
          <div className="mt-2 bg-white border rounded-lg shadow-sm p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Search Results</div>
            <div className="space-y-2 max-h-60 overflow-auto">
              {searchResults.heads.map((head) => (
                <button
                  key={head.id}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => navigateToCategory('head', head)}
                >
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">HEAD</span>
                  <span className="text-sm">{head.name}</span>
                </button>
              ))}

              {searchResults.subs.map((sub) => (
                <button
                  key={sub.id}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => navigateToCategory('sub', sub)}
                >
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">SUB</span>
                  <span className="text-sm">{sub.name}</span>
                </button>
              ))}

              {searchResults.micros.map((micro) => (
                <button
                  key={micro.id}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => navigateToCategory('micro', micro)}
                >
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">MICRO</span>
                  <span className="text-sm">{micro.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-white border rounded-lg">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading categories...</div>
        ) : (
          headCategories.map((headCategory) => (
            <div key={headCategory.id} className="border-b last:border-b-0">
              {/* HEAD CATEGORY */}
              <div
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                onClick={() => toggleHeadExpansion(headCategory.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedHeads[headCategory.id] ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <div className="font-semibold text-lg">{headCategory.name}</div>
                    <div className="text-xs text-gray-500">{headCategory.slug}</div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog('head', headCategory)} className="gap-1">
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => openDeleteDialog('head', headCategory)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* SUB CATEGORIES */}
              {expandedHeads[headCategory.id] && (
                <div className="bg-gray-50 border-t">
                  {/* ✅ Always show Add Sub Category even when there are 0 sub-categories */}
                  <div className="flex items-center justify-between gap-3 ml-8 px-4 py-2 bg-gray-50 border-b">
                    <div className="text-xs text-gray-500">
                      Sub-categories for <span className="font-medium text-gray-700">{headCategory.name}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddDialog('sub', headCategory.id, headCategory.name);
                      }}
                      className="gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Sub Category
                    </Button>
                  </div>

                  {subCategories[headCategory.id]?.map((subCategory) => (
                    <div key={subCategory.id} className="border-b">
                      <div className="p-4 ml-8 hover:bg-white flex items-center gap-3 justify-between group">
                        <div className="flex-1 cursor-pointer flex items-center gap-3" onClick={() => toggleSubExpansion(subCategory.id)}>
                          {expandedSubs[subCategory.id] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <div>
                            <div className="font-medium">{subCategory.name}</div>
                            <div className="text-xs text-gray-500">{subCategory.slug}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog('sub', subCategory, headCategory.id)}
                            className="gap-1"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => openDeleteDialog('sub', subCategory, headCategory.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* ADD MICRO BUTTON */}
                      <div className="flex gap-2 ml-16 px-4 py-2 bg-gray-50 border-b">
                        <Button
                          size="sm"
                          onClick={() => openAddDialog('micro', subCategory.id, subCategory.name)}
                          className="gap-1 ml-auto"
                        >
                          <Plus className="w-3 h-3" />
                          Add Micro Category
                        </Button>
                      </div>

                      {/* MICRO CATEGORIES */}
                      {expandedSubs[subCategory.id] && (
                        <div className="bg-white border-t">
                          {microCategories[subCategory.id]?.map((microCategory) => (
                            <div
                              key={microCategory.id}
                              className="p-4 ml-16 border-b hover:bg-blue-50 flex items-center justify-between gap-3 group"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{microCategory.name}</div>
                                <div className="text-xs text-gray-500">{microCategory.slug}</div>
                                {microMeta[microCategory.id] && (
                                  <div className="text-xs text-green-600 mt-1">✓ Meta tags configured</div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Dialog
                                  open={showMetaDialog && selectedMicroCategory?.id === microCategory.id}
                                  onOpenChange={setShowMetaDialog}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openMetaDialog(microCategory)}
                                      className="gap-1"
                                    >
                                      <Tag className="w-4 h-4" />
                                      Meta
                                    </Button>
                                  </DialogTrigger>

                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Meta Tags & Description - {microCategory.name}</DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4">
                                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                        <p className="text-sm text-blue-900">
                                          <strong>ℹ️ Note:</strong> State and city names will be automatically appended to
                                          these meta tags and description on the website.
                                        </p>
                                        <p className="text-xs text-blue-700 mt-2">
                                          Example: "Mobile Phones" → "Mobile Phones in Delhi, Delhi" on website
                                        </p>
                                      </div>

                                      <div>
                                        <Label>Base Meta Tags (comma separated)</Label>
                                        <Input
                                          value={metaData.meta_tags}
                                          onChange={(e) => setMetaData((prev) => ({ ...prev, meta_tags: e.target.value }))}
                                          placeholder="e.g. electronics, phones, mobile"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          Only the base keywords - location will be added automatically
                                        </p>
                                      </div>

                                      <div>
                                        <Label>Base Description</Label>
                                        <Textarea
                                          value={metaData.description}
                                          onChange={(e) => setMetaData((prev) => ({ ...prev, description: e.target.value }))}
                                          placeholder="e.g. High-quality mobile phones with latest features and competitive prices"
                                          rows={4}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          Keep under 150 characters - " in [City], [State]" will be appended
                                        </p>
                                      </div>

                                      <Button onClick={saveMeta} className="w-full">
                                        Save Meta Information
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog('micro', microCategory, subCategory.id)}
                                  className="gap-1"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => openDeleteDialog('micro', microCategory, subCategory.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )) || (
                            <div className="p-4 ml-16 text-sm text-gray-500">No micro categories</div>
                          )}
                        </div>
                      )}
                    </div>
                  )) || (
                    <div className="p-4 ml-8 text-sm text-gray-500">No sub categories</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {headCategories.length === 0 && (
          <div className="p-8 text-center text-gray-500">No categories found. Create head categories first.</div>
        )}
      </div>

      {/* ADD/EDIT DIALOG */}
      <AddEditCategoryDialog
        isOpen={showAddEditDialog}
        onClose={() => setShowAddEditDialog(false)}
        category={selectedCategory}
        level={dialogLevel}
        parentId={parentCategory?.id}
        onSave={handleSaveCategory}
      />

      {/* DELETE DIALOG */}
      <DeleteCategoryDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        category={selectedCategory}
        level={dialogLevel}
        childCount={childCount}
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
};
export default CategoriesFixed;
