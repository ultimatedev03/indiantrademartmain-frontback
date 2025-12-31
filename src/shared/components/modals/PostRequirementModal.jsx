import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { directoryApi } from '@/modules/directory/api/directoryApi';

const PostRequirementModal = ({ isOpen, onClose }) => {
  // Debug log
  console.log('PostRequirementModal isOpen:', isOpen);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    quantity: '',
    budget: '',
    companyName: '',
    email: '',
    phone: ''
  });

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchInput.length > 0) {
      const filtered = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchInput.toLowerCase())
      );
      setFilteredCategories(filtered);
      setShowCategoryDropdown(true);
    } else {
      setFilteredCategories([]);
      setShowCategoryDropdown(false);
    }
  }, [searchInput, categories]);

  const loadCategories = async () => {
    try {
      const cats = await directoryApi.getHeadCategories();
      setCategories(cats || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategorySearch = (value) => {
    setSearchInput(value);
  };

  const selectCategory = (category) => {
    setFormData(prev => ({
      ...prev,
      category: category.name
    }));
    setSearchInput(category.name);
    setShowCategoryDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a requirement title",
        variant: "destructive"
      });
      return;
    }
    if (!formData.category.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter or select a category",
        variant: "destructive"
      });
      return;
    }
    if (!formData.description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a description",
        variant: "destructive"
      });
      return;
    }
    if (!formData.quantity.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter quantity",
        variant: "destructive"
      });
      return;
    }
    if (!formData.companyName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter company name",
        variant: "destructive"
      });
      return;
    }
    if (!formData.email.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter email",
        variant: "destructive"
      });
      return;
    }
    if (!formData.phone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter phone number",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const payload = {
        title: formData.title,
        product_name: formData.title,
        category: formData.category,
        description: formData.description,
        quantity: formData.quantity,
        budget: parseFloat(formData.budget) || 0,
        company_name: formData.companyName,
        buyer_name: formData.companyName,
        buyer_email: formData.email,
        buyer_phone: formData.phone,
        status: 'AVAILABLE',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('leads')
        .insert([payload]);

      if (error) throw error;
      
      toast({
        title: "Requirement Posted!",
        description: "Suppliers will contact you soon.",
        className: "bg-green-600 text-white border-green-700"
      });
      
      setFormData({
        title: '',
        category: '',
        description: '',
        quantity: '',
        budget: '',
        companyName: '',
        email: '',
        phone: ''
      });
      setSearchInput('');
      
      onClose();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to post requirement. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Post Your Requirement</h2>
            <p className="text-blue-100 text-sm mt-1">Connect with verified suppliers</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What do you need? *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Industrial Motors, Textiles, etc."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category with Search */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Category *
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleCategorySearch(e.target.value)}
              placeholder="Search or type category name..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* Dropdown Suggestions */}
            {showCategoryDropdown && filteredCategories.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => selectCategory(cat)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-200 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-gray-800">{cat.name}</div>
                    {cat.description && (
                      <div className="text-xs text-gray-500">{cat.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your requirement in detail..."
              rows="4"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Quantity & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity *
              </label>
              <input
                type="text"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="e.g., 100 units"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Budget (Optional)
              </label>
              <input
                type="text"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="e.g., 50,000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Company & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Your company name"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Your email address"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 XXXXX XXXXX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Posting...' : 'Post Requirement'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostRequirementModal;
