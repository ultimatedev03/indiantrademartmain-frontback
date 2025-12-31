
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { buyerApi } from '@/modules/buyer/services/buyerApi';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Send } from 'lucide-react';

const CreateProposal = () => {
  const { buyerId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    quantity: '',
    budget: '',
    location: '',
    description: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!buyerId) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    if (!formData.category || !formData.quantity || !formData.budget || !formData.description) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      await buyerApi.createProposal({
        buyer_id: buyerId,
        category: formData.category,
        quantity: formData.quantity,
        budget: formData.budget,
        location: formData.location,
        description: formData.description
      });

      toast({ 
        title: "Success", 
        description: "Your requirement has been posted successfully.", 
        className: "bg-green-50 border-green-200 text-green-900" 
      });
      
      setTimeout(() => navigate('/buyer/proposals'), 300);

    } catch (error) {
      console.error("Submission failed:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create proposal. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
           <h1 className="text-3xl font-bold tracking-tight">New Proposal</h1>
           <p className="text-gray-500">Post a new requirement to get quotes from vendors</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requirement Details</CardTitle>
          <CardDescription>Fill in the details to receive accurate quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="category">Select Category *</Label>
              <Select onValueChange={(val) => handleChange('category', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Automotive">Automotive</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Textiles">Textiles</SelectItem>
                  <SelectItem value="Construction">Construction</SelectItem>
                  <SelectItem value="Industrial">Industrial Machinery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <div className="flex gap-2">
                  <Input 
                    id="quantity" 
                    type="number" 
                    placeholder="e.g. 100" 
                    value={formData.quantity}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                  />
                  <div className="flex items-center justify-center px-3 bg-gray-50 border rounded-md text-sm text-gray-500">
                    Units
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (₹) *</Label>
                <Input 
                  id="budget" 
                  type="number" 
                  placeholder="e.g. 50000" 
                  value={formData.budget}
                  onChange={(e) => handleChange('budget', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Delivery Location *</Label>
              <Input 
                id="location" 
                placeholder="City or Pincode" 
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Requirement *</Label>
              <Textarea 
                id="description" 
                placeholder="Describe your requirement in detail (specifications, quality, brands, etc.)" 
                className="min-h-[150px]"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div className="pt-4 flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#003D82] min-w-[150px]" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Post Requirement
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateProposal;
