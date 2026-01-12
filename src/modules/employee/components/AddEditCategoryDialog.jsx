import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const AddEditCategoryDialog = ({ 
  isOpen, 
  onClose, 
  category = null,  // null for add, object for edit
  level,            // 'head', 'sub', or 'micro'
  parentId = null,  // required for sub/micro
  onSave 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    is_active: true
  });

  // image upload (optional)
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageFilePreview, setImageFilePreview] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Initialize form with category data if editing
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        slug: category.slug || '',
        description: category.description || '',
        image_url: category.image_url || '',
        is_active: category.is_active !== false
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        image_url: '',
        is_active: true
      });
    }
    setImageFile(null);
    setRemoveImage(false);
    setErrors({});
  }, [category, isOpen]);

  const showImageField = useMemo(() => {
    // user asked specifically for head + micro, but we support sub too (since schema already has image_url)
    return level === 'head' || level === 'sub' || level === 'micro';
  }, [level]);

  // Preview for local file (cleanup URL on change/unmount)
  useEffect(() => {
    if (!imageFile) {
      setImageFilePreview('');
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageFilePreview(url);
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    };
  }, [imageFile]);

  const previewUrl = useMemo(() => {
    if (imageFilePreview) return imageFilePreview;
    const url = (formData.image_url || '').trim();
    return url.length > 0 ? url : '';
  }, [imageFilePreview, formData.image_url]);
  
  // Auto-generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };
  
  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      await onSave({
        ...formData,
        imageFile,
        removeImage,
        parentId,
        id: category?.id
      });
      onClose();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getLevelName = () => {
    switch (level) {
      case 'head': return 'Head Category';
      case 'sub': return 'Sub Category';
      case 'micro': return 'Micro Category';
      default: return 'Category';
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit' : 'Add New'} {getLevelName()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={`Enter ${getLevelName().toLowerCase()} name`}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="slug">
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="auto-generated-from-name"
              className={errors.slug ? 'border-red-500' : ''}
            />
            {errors.slug && (
              <p className="text-xs text-red-500 mt-1">{errors.slug}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">URL-friendly identifier (auto-generated, can be edited)</p>
          </div>
          
          {level !== 'micro' && (
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={`Optional description for ${getLevelName().toLowerCase()}`}
                rows={3}
              />
            </div>
          )}

          {showImageField && (
            <div className="space-y-2">
              <Label>Image (optional)</Label>

              {/* Preview */}
              <div className="flex items-start gap-4">
                <div className="w-28 h-20 rounded-md border bg-slate-50 overflow-hidden flex items-center justify-center">
                  {previewUrl && !removeImage ? (
                    <img
                      src={previewUrl}
                      alt={formData.name || 'Category image'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-xs text-slate-500 font-semibold">
                      {String(formData.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="image_file" className="text-xs text-slate-600">
                      Upload image
                    </Label>
                    <Input
                      id="image_file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setImageFile(f);
                        if (f) {
                          setRemoveImage(false);
                          // user picked a file -> ignore any typed url
                        }
                      }}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      PNG/JPG/WebP recommended. This will be shown on directory pages.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="image_url" className="text-xs text-slate-600">
                      Or paste image URL
                    </Label>
                    <Input
                      id="image_url"
                      value={formData.image_url || ''}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, image_url: e.target.value }));
                        if (e.target.value?.trim()) {
                          setImageFile(null);
                          setRemoveImage(false);
                        }
                      }}
                      placeholder="https://..."
                    />
                  </div>

                  {!!category?.image_url && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remove_image"
                        checked={removeImage}
                        onCheckedChange={(checked) => {
                          const v = !!checked;
                          setRemoveImage(v);
                          if (v) {
                            setImageFile(null);
                          }
                        }}
                      />
                      <Label htmlFor="remove_image" className="cursor-pointer text-sm">
                        Remove existing image
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active (visible to users)
            </Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : category ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditCategoryDialog;
