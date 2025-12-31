
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BadgeCheck, MapPin, Send, Star, Phone, Globe, Building2, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Card from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { useBuyerAuth } from '@/modules/buyer/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

// Internal Mock Data to ensure page is never blank
const FALLBACK_VENDORS = [
  {
    id: '1',
    company_name: "Aggarwal Enterprises",
    name: "Rajesh Aggarwal",
    city: "New Delhi",
    state: "Delhi",
    rating: 4.5,
    reviews: 124,
    verified: true,
    description: "Leading supplier of industrial construction materials with over 20 years of experience. We specialize in steel, cement, and safety equipment.",
    phone: "+91-9876543210",
    email: "contact@aggarwal.com",
    address: "Plot 45, Okhla Industrial Area, Phase III",
    established: "1998"
  },
  {
     id: '2',
     company_name: "Tech Solutions Pvt Ltd",
     city: "Mumbai",
     state: "Maharashtra",
     verified: true,
     rating: 4.8,
     reviews: 89
  }
];

const FALLBACK_PRODUCTS = [
  { id: 101, name: "Industrial Safety Shoes", price: "₹850", category: "Safety Gear", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80" },
  { id: 102, name: "High Grade Cement (50kg)", price: "₹380", category: "Construction", image: "https://images.unsplash.com/photo-1518709414768-a8c55406a779?auto=format&fit=crop&w=300&q=80" },
  { id: 103, name: "Steel TMT Bars", price: "₹45,000/ton", category: "Raw Material", image: "https://images.unsplash.com/photo-1535813547-99c456a41d4a?auto=format&fit=crop&w=300&q=80" },
  { id: 104, name: "Safety Helmets", price: "₹120", category: "Safety Gear", image: "https://images.unsplash.com/photo-1595166661134-8c8a164b1d6f?auto=format&fit=crop&w=300&q=80" },
];

const VendorProfile = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated: isBuyer } = useBuyerAuth();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch with robust fallback
    const fetchVendor = async () => {
      setLoading(true);
      try {
        // In a real scenario, we would await apiClient.get(...) here.
        // For now, we search our fallback list or generate dummy data if ID is unknown.
        
        await new Promise(r => setTimeout(r, 600)); // Fake delay

        let foundVendor = FALLBACK_VENDORS.find(v => v.id.toString() === vendorId);
        
        // If not in fallback list, generate a generic one so page isn't blank
        if (!foundVendor) {
           foundVendor = {
             id: vendorId,
             company_name: "Verified Supplier",
             name: "Vendor Owner",
             city: "India",
             state: "",
             rating: 4.0,
             reviews: 12,
             verified: false,
             description: "This vendor is registered on IndianTradeMart.",
             phone: "+91-XXXXXXXXXX",
             address: "Address available on request",
             established: "2020"
           };
        }

        setVendor(foundVendor);
        setProducts(FALLBACK_PRODUCTS); // Attach dummy products to everyone for demo
      } catch (e) {
        console.error("Vendor fetch failed", e);
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!vendor) return <div className="p-8 text-center text-red-500">Vendor not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl font-sans">
      
      {/* Hero / Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
         <div className="bg-[#003D82] h-24 w-full"></div>
         <div className="px-8 pb-8">
            <div className="relative flex flex-col md:flex-row justify-between items-start -mt-10">
               <div className="flex gap-6 items-end">
                  <div className="h-24 w-24 rounded-lg bg-white p-1 shadow-md border border-gray-100">
                     <div className="h-full w-full bg-gray-100 rounded flex items-center justify-center text-2xl font-bold text-[#003D82]">
                        {vendor.company_name.charAt(0)}
                     </div>
                  </div>
                  <div className="pb-1">
                     <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        {vendor.company_name}
                        {vendor.verified && <BadgeCheck className="text-blue-500 h-6 w-6 fill-blue-50" />}
                     </h1>
                     <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}</span>
                        <span className="flex items-center gap-1"><Star className="h-4 w-4 text-orange-400 fill-orange-400" /> {vendor.rating} ({vendor.reviews} Reviews)</span>
                     </div>
                  </div>
               </div>

               <div className="mt-6 md:mt-0 flex gap-3">
                 <Button variant="outline" className="border-gray-300">
                   <Phone className="h-4 w-4 mr-2" /> View Number
                 </Button>
                 <Button 
                   className="bg-[#00A699] hover:bg-[#008c81]"
                   onClick={() => {
                     if(isBuyer) navigate(`/buyer/proposals/new?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendor.company_name)}`);
                     else navigate('/buyer/login');
                   }}
                 >
                   <Send className="h-4 w-4 mr-2" /> Send Proposal
                 </Button>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Main Content: Products & About */}
         <div className="lg:col-span-2 space-y-8">
            <Tabs defaultValue="products">
               <TabsList className="w-full justify-start border-b rounded-none p-0 h-auto bg-transparent gap-6">
                  <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">Products</TabsTrigger>
                  <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">About Company</TabsTrigger>
                  <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A699] data-[state=active]:shadow-none px-4 py-3 text-base">Reviews</TabsTrigger>
               </TabsList>

               <TabsContent value="products" className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {products.map(product => (
                      <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
                         <div className="h-48 bg-gray-100 relative overflow-hidden">
                           <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                         </div>
                         <Card.Content className="p-4">
                            <Badge variant="outline" className="mb-2">{product.category}</Badge>
                            <h3 className="font-semibold text-lg text-gray-900 mb-1">{product.name}</h3>
                            <div className="flex justify-between items-center mt-2">
                               <span className="font-bold text-[#003D82] text-lg">{product.price}</span>
                               <Button size="sm" variant="secondary" className="h-8">Enquire</Button>
                            </div>
                         </Card.Content>
                      </Card>
                    ))}
                  </div>
               </TabsContent>

               <TabsContent value="about" className="pt-6">
                  <Card>
                    <Card.Content className="p-6">
                      <h3 className="text-xl font-bold mb-4">About {vendor.company_name}</h3>
                      <p className="text-gray-600 leading-relaxed mb-6">
                        {vendor.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-6">
                         <div>
                            <p className="text-sm text-gray-500 mb-1">Business Type</p>
                            <p className="font-medium">Manufacturer, Supplier</p>
                         </div>
                         <div>
                            <p className="text-sm text-gray-500 mb-1">Established</p>
                            <p className="font-medium">{vendor.established || '2010'}</p>
                         </div>
                         <div>
                            <p className="text-sm text-gray-500 mb-1">Employees</p>
                            <p className="font-medium">50-100 People</p>
                         </div>
                         <div>
                            <p className="text-sm text-gray-500 mb-1">Annual Turnover</p>
                            <p className="font-medium">₹5 - 10 Cr</p>
                         </div>
                      </div>
                    </Card.Content>
                  </Card>
               </TabsContent>

               <TabsContent value="reviews" className="pt-6">
                  <Card>
                     <Card.Content className="p-6 text-center text-gray-500">
                        <Star className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p>No detailed reviews available yet.</p>
                     </Card.Content>
                  </Card>
               </TabsContent>
            </Tabs>
         </div>

         {/* Sidebar: Contact Info */}
         <div className="lg:col-span-1 space-y-6">
            <Card>
               <Card.Content className="p-6 space-y-4">
                  <h3 className="font-bold text-gray-900 border-b pb-2">Contact Details</h3>
                  
                  <div className="flex gap-3 items-start">
                     <div className="bg-blue-50 p-2 rounded-lg"><User className="h-5 w-5 text-blue-600" /></div>
                     <div>
                        <p className="text-xs text-gray-500">Contact Person</p>
                        <p className="font-medium">{vendor.name}</p>
                     </div>
                  </div>

                  <div className="flex gap-3 items-start">
                     <div className="bg-green-50 p-2 rounded-lg"><Phone className="h-5 w-5 text-green-600" /></div>
                     <div>
                        <p className="text-xs text-gray-500">Mobile Number</p>
                        <p className="font-medium text-green-700">{vendor.phone}</p>
                     </div>
                  </div>

                  <div className="flex gap-3 items-start">
                     <div className="bg-purple-50 p-2 rounded-lg"><Building2 className="h-5 w-5 text-purple-600" /></div>
                     <div>
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="font-medium text-sm">{vendor.address}</p>
                        <p className="text-sm text-gray-600">{vendor.city}, {vendor.state}</p>
                     </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button className="w-full bg-[#003D82]">Contact Supplier</Button>
                  </div>
               </Card.Content>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
               <Card.Content className="p-6">
                  <h3 className="font-bold text-indigo-900 mb-2">Safe Trading Guide</h3>
                  <ul className="text-sm text-indigo-800 space-y-2 list-disc pl-4">
                     <li>Check verified badge before dealing</li>
                     <li>Always communicate via portal</li>
                     <li>Never pay to personal bank accounts</li>
                  </ul>
               </Card.Content>
            </Card>
         </div>
      </div>
    </div>
  );
};

export default VendorProfile;
