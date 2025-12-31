import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Tag } from 'lucide-react';

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
  const [metaData, setMetaData] = useState({ meta_tags: '', description: '' });
  
  const [loading, setLoading] = useState(false);

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
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      setSubCategories(prev => ({ ...prev, [headCategoryId]: data || [] }));
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      setMicroCategories(prev => ({ ...prev, [subCategoryId]: data || [] }));
      
      // Fetch meta for each micro category
      if (data && data.length > 0) {
        data.forEach(micro => {
          fetchMicroMeta(micro.id);
        });
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      setMicroMeta(prev => ({ ...prev, [microCategoryId]: data || null }));
    } catch (error) {
      console.error('Error fetching meta:', error);
    }
  };

  // Toggle head category expansion
  const toggleHeadExpansion = (headId) => {
    if (expandedHeads[headId]) {
      setExpandedHeads(prev => ({ ...prev, [headId]: false }));
    } else {
      setExpandedHeads(prev => ({ ...prev, [headId]: true }));
      fetchSubCategories(headId);
    }
  };

  // Toggle sub category expansion
  const toggleSubExpansion = (subId) => {
    if (expandedSubs[subId]) {
      setExpandedSubs(prev => ({ ...prev, [subId]: false }));
    } else {
      setExpandedSubs(prev => ({ ...prev, [subId]: true }));
      fetchMicroCategories(subId);
    }
  };

  // Open meta dialog for micro category
  const openMetaDialog = (microCategory) => {
    setSelectedMicroCategory(microCategory);
    const meta = microMeta[microCategory.id];
    setMetaData({
      meta_tags: meta?.meta_tags || '',
      description: meta?.description || ''
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
            updated_at: new Date().toISOString()
          })
          .eq('micro_categories', selectedMicroCategory.id);
        
        if (error) {
          if (error.code === '42501') {
            toast({ title: "Permission Denied", description: "RLS policy blocks this operation. Contact admin to fix permissions.", variant: "destructive" });
          } else {
            throw error;
          }
          return;
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('micro_category_meta')
          .insert([{
            micro_categories: selectedMicroCategory.id,
            meta_tags: metaData.meta_tags,
            description: metaData.description,
            created_at: new Date().toISOString()
          }]);
        
        if (error) {
          if (error.code === '42501') {
            toast({ title: "Permission Denied", description: "RLS policy blocks this operation. Contact admin to fix permissions.", variant: "destructive" });
          } else {
            throw error;
          }
          return;
        }
      }
      
      toast({ title: "Success", description: "Meta information saved" });
      setShowMetaDialog(false);
      fetchMicroMeta(selectedMicroCategory.id);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading categories...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Category Management</h2>
      </div>

      <div className="bg-white rounded border">
        <div className="p-4 border-b bg-gray-50">
          <p className="text-sm text-gray-600">Click on categories to expand and manage subcategories and meta information</p>
        </div>

        <div className="divide-y">
          {headCategories.map(headCategory => (
            <div key={headCategory.id} className="border-b">
              {/* HEAD CATEGORY */}
              <div 
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                onClick={() => toggleHeadExpansion(headCategory.id)}
              >
                {expandedHeads[headCategory.id] ? 
                  <ChevronDown className="w-5 h-5" /> : 
                  <ChevronRight className="w-5 h-5" />
                }
                <div className="flex-1">
                  <div className="font-semibold text-lg">{headCategory.name}</div>
                  <div className="text-xs text-gray-500">{headCategory.slug}</div>
                </div>
              </div>

              {/* SUB CATEGORIES */}
              {expandedHeads[headCategory.id] && (
                <div className="bg-gray-50 border-t">
                  {subCategories[headCategory.id]?.map(subCategory => (
                    <div key={subCategory.id} className="border-b">
                      <div 
                        className="p-4 ml-8 hover:bg-white cursor-pointer flex items-center gap-3"
                        onClick={() => toggleSubExpansion(subCategory.id)}
                      >
                        {expandedSubs[subCategory.id] ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                        <div className="flex-1">
                          <div className="font-medium">{subCategory.name}</div>
                          <div className="text-xs text-gray-500">{subCategory.slug}</div>
                        </div>
                      </div>

                      {/* MICRO CATEGORIES */}
                      {expandedSubs[subCategory.id] && (
                        <div className="bg-white border-t">
                          {microCategories[subCategory.id]?.map(microCategory => (
                            <div key={microCategory.id} className="p-4 ml-16 border-b hover:bg-blue-50 flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{microCategory.name}</div>
                                <div className="text-xs text-gray-500">{microCategory.slug}</div>
                                {microMeta[microCategory.id] && (
                                  <div className="text-xs text-green-600 mt-1">✓ Meta tags configured</div>
                                )}
                              </div>
                              
                              <Dialog open={showMetaDialog && selectedMicroCategory?.id === microCategory.id} onOpenChange={setShowMetaDialog}>
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
                                    <div>
                                      <Label>Meta Tags (comma separated)</Label>
                                      <Input 
                                        value={metaData.meta_tags}
                                        onChange={e => setMetaData(prev => ({ ...prev, meta_tags: e.target.value }))}
                                        placeholder="e.g. electronics, phones, mobile"
                                      />
                                      <p className="text-xs text-gray-500 mt-1">Used for SEO and search optimization</p>
                                    </div>
                                    
                                    <div>
                                      <Label>Meta Description</Label>
                                      <Textarea 
                                        value={metaData.description}
                                        onChange={e => setMetaData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Category description for search engines and browsers"
                                        rows={4}
                                      />
                                      <p className="text-xs text-gray-500 mt-1">Keep under 160 characters for best display</p>
                                    </div>
                                    
                                    <Button onClick={saveMeta} className="w-full">
                                      Save Meta Information
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )) || (
                            <div className="p-4 ml-16 text-sm text-gray-500">
                              No micro categories
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )) || (
                    <div className="p-4 ml-8 text-sm text-gray-500">
                      No sub categories
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {headCategories.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No categories found. Create head categories first.
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesFixed;
