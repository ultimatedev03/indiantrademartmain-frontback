
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dataEntryApi } from '@/modules/employee/services/dataEntryApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Upload, X, Loader2, Video } from 'lucide-react';

const AddProduct = () => {
  const { vendorId, productId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!productId;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: '',
    description: '',
    head_category: '',
    head_category_id: '',
    sub_category: '',
    sub_category_id: '',
    micro_category: '',
    micro_category_id: '',
    images: [], // Array of URLs
    video: ''   // URL
  });

  // Categories Data
  const [categoriesTree, setCategoriesTree] = useState([]);
  const [subCats, setSubCats] = useState([]);
  const [microCats, setMicroCats] = useState([]);

  // File Uploads
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, [isEdit, productId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      console.log('📦 Loading initial data... isEdit:', isEdit, 'productId:', productId);
      
      // Load Categories
      console.log('📂 Fetching categories tree...');
      const tree = await dataEntryApi.getCategoriesTree();
      console.log('✅ Categories loaded:', tree?.length);
      setCategoriesTree(tree);

      // If Edit Mode, Load Product
      if (isEdit && productId) {
        console.log('📝 Loading product for edit:', productId);
        const product = await dataEntryApi.getProductById(productId);
        console.log('✅ Product loaded:', product);
        
        // Find head, sub, micro category IDs by traversing tree
        let headId = product.head_category_id || '';
        let subId = product.sub_category_id || '';
        let microId = product.micro_category_id || '';
        let headName = '';
        let subName = '';
        let microName = '';

        // Find head category
        const headCat = tree.find(h => h.id === headId);
        if (headCat) {
          headName = headCat.name;
          setSubCats(headCat.subs);
          
          // Find sub category
          const subCat = headCat.subs.find(s => s.id === subId);
          if (subCat) {
            subName = subCat.name;
            setMicroCats(subCat.micros);
            
            // Find micro category
            const microCat = subCat.micros.find(m => m.id === microId);
            if (microCat) {
              microName = microCat.name;
            }
          }
        }

        // Convert images JSONB to array if needed
        let imageArray = [];
        
        // First check product_images relation
        if (product.product_images && Array.isArray(product.product_images) && product.product_images.length > 0) {
          imageArray = product.product_images.map(img => img.image_url);
        } else if (product.images) {
          // Fallback to images JSONB field
          imageArray = product.images;
          if (typeof imageArray === 'string') {
            try {
              imageArray = JSON.parse(imageArray);
            } catch (e) {
              imageArray = [];
            }
          }
          if (!Array.isArray(imageArray)) {
            imageArray = [];
          }
        }

        setFormData({
          name: product.name || '',
          price: product.price || '',
          quantity: product.stock || '',
          description: product.description || '',
          head_category: headName,
          head_category_id: headId,
          sub_category: subName,
          sub_category_id: subId,
          micro_category: microName,
          micro_category_id: microId,
          images: imageArray,
          video: product.video_url || ''
        });
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      console.error('Error details:', error?.message, error?.code);
      toast({ title: "Error", description: error?.message || "Failed to load data", variant: "destructive" });
    } finally {
      console.log('🏁 Loading complete');
      setLoading(false);
    }
  };

  // Category Handlers
  const handleHeadChange = (val) => {
    const head = categoriesTree.find(h => h.id === val);
    setFormData(p => ({ ...p, head_category_id: val, head_category: head?.name || '', sub_category: '', sub_category_id: '', micro_category: '', micro_category_id: '' }));
    setSubCats(head ? head.subs : []);
  };

  const handleSubChange = (val) => {
    const sub = subCats.find(s => s.id === val);
    setFormData(p => ({ ...p, sub_category_id: val, sub_category: sub?.name || '', micro_category: '', micro_category_id: '' }));
    setMicroCats(sub ? sub.micros : []);
  };

  const handleMicroChange = (val) => {
    const micro = microCats.find(m => m.id === val); // val is ID here
    setFormData(p => ({ ...p, micro_category_id: val, micro_category: micro ? micro.name : '' }));
  };

  // Auto-detect Category
  const handleNameBlur = () => {
    if (!formData.name || formData.micro_category_id) return;
    
    // Simple search in all micros
    for (const head of categoriesTree) {
      for (const sub of head.subs) {
        for (const micro of sub.micros) {
          if (formData.name.toLowerCase().includes(micro.name.toLowerCase())) {
            // Found match
            setFormData(p => ({
              ...p,
              head_category: head.name,
              sub_category: sub.name,
              micro_category: micro.name,
              micro_category_id: micro.id
            }));
            setSubCats(head.subs);
            setMicroCats(sub.micros);
            toast({ title: "Category Detected", description: `Auto-selected: ${micro.name}` });
            return;
          }
        }
      }
    }
  };

  // File Handlers
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + formData.images.length > 5) {
      toast({ title: "Limit Exceeded", description: "Max 5 images allowed", variant: "destructive" });
      return;
    }
    setImageFiles(prev => [...prev, ...files]);
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Video max 50MB", variant: "destructive" });
      return;
    }
    setVideoFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.micro_category_id && !isEdit) {
       toast({ title: "Required", description: "Please select a category", variant: "destructive" });
       return;
    }

    setSubmitting(true);
    try {
      // 1. Upload Files
      const newImageUrls = [];
      for (const file of imageFiles) {
        const url = await dataEntryApi.uploadProductMedia(file, 'image');
        newImageUrls.push(url);
      }
      
      let videoUrl = formData.video;
      if (videoFile) {
        videoUrl = await dataEntryApi.uploadProductMedia(videoFile, 'video');
      }

      const finalImages = [...formData.images, ...newImageUrls];

      const payload = {
        vendor_id: vendorId,
        name: formData.name,
        price: parseFloat(formData.price),
        moq: 1, // Default minimum order quantity
        stock: parseInt(formData.quantity),
        description: formData.description,
        head_category_id: formData.head_category_id || null,
        sub_category_id: formData.sub_category_id || null,
        micro_category_id: formData.micro_category_id,
        category: formData.micro_category, // Legacy field
        images: finalImages, // Legacy field - still store for backward compatibility
        video_url: videoUrl, // Legacy field
        status: 'ACTIVE'
      };

      if (isEdit) {
        await dataEntryApi.updateProduct(productId, payload);
        toast({ title: "Success", description: "Product updated" });
      } else {
        await dataEntryApi.addProduct(payload);
        toast({ title: "Success", description: "Product created" });
      }
      
      navigate(`/employee/dataentry/vendors/${vendorId}/products`);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Operation failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center py-8">
            <Loader2 className="animate-spin mx-auto w-8 h-8" />
            <p className="text-gray-500 mt-4">Loading product details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>Product Name <span className="text-red-500">*</span></Label>
              <Input 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                onBlur={handleNameBlur}
                placeholder="e.g. Cotton Saree"
              />
            </div>

            {/* Categories */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Head Category</Label>
                <Select value={formData.head_category_id} onValueChange={handleHeadChange}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {categoriesTree.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub Category</Label>
                <Select value={formData.sub_category_id} onValueChange={handleSubChange} disabled={!formData.head_category_id || loading}>
                  <SelectTrigger><SelectValue placeholder={loading ? 'Loading...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {subCats.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Micro Category <span className="text-red-500">*</span></Label>
                <Select value={formData.micro_category_id} onValueChange={handleMicroChange} disabled={!formData.sub_category_id || loading}>
                  <SelectTrigger><SelectValue placeholder={loading ? 'Loading...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {microCats.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price & Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (₹) <span className="text-red-500">*</span></Label>
                <Input type="number" required min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Quantity <span className="text-red-500">*</span></Label>
                <Input type="number" required min="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                rows={4}
              />
            </div>

            {/* Media */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Product Media</h3>
              
              <div className="space-y-2">
                <Label>Images (Max 5)</Label>
                <div className="flex flex-wrap gap-4">
                  {formData.images.map((url, idx) => (
                    <div key={idx} className="relative w-24 h-24 border rounded overflow-hidden">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl"
                        onClick={() => setFormData(p => ({...p, images: p.images.filter((_, i) => i !== idx)}))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {imageFiles.map((file, idx) => (
                    <div key={`new-${idx}`} className="relative w-24 h-24 border rounded bg-gray-50 flex items-center justify-center">
                      <span className="text-xs text-gray-500 truncate px-1">{file.name}</span>
                      <button 
                        type="button"
                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl"
                        onClick={() => setImageFiles(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Add Image</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageSelect} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Video (Max 50MB)</Label>
                <div className="flex items-center gap-4">
                  {formData.video && !videoFile && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Video className="w-4 h-4" /> Video Uploaded
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormData(p => ({...p, video: ''}))}>Remove</Button>
                    </div>
                  )}
                  {videoFile && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Video className="w-4 h-4" /> {videoFile.name}
                      <Button type="button" variant="ghost" size="sm" onClick={() => setVideoFile(null)}>Remove</Button>
                    </div>
                  )}
                  {!formData.video && !videoFile && (
                    <Input type="file" accept="video/*" onChange={handleVideoSelect} className="max-w-xs" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin mr-2" /> : null} 
                {isEdit ? 'Update Product' : 'Create Product'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default AddProduct;
