import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, CheckCircle, Phone, Mail, FileText, PlayCircle, MessageCircle, Facebook, Linkedin, Twitter, Link as LinkIcon, Check } from 'lucide-react';
import { shareUtils } from '@/shared/utils/shareUtils';
import { phoneUtils } from '@/shared/utils/phoneUtils';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProductDetail = () => {
  const { productSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isDraft, setIsDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullPhone, setShowFullPhone] = useState(false);

  const handleCopyLink = async () => {
    const url = shareUtils.getCurrentUrl();
    const success = await shareUtils.copyToClipboard(url);
    if (success) {
      setCopied(true);
      toast({ title: 'Link copied to clipboard!', description: 'Share the link with anyone' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: 'Failed to copy', description: 'Please try again', variant: 'destructive' });
    }
  };

  const handleSendEnquiry = async () => {
    // Check if user is logged in
    if (!user) {
      toast({ title: 'Please Login', description: 'You need to login as a buyer to send enquiry', variant: 'destructive' });
      navigate('/buyer/login');
      return;
    }

    // Check if user is a buyer
    if (user.role !== 'BUYER') {
      toast({ title: 'Buyer Account Required', description: 'Only buyers can send enquiries', variant: 'destructive' });
      return;
    }

    // Create a lead in the database
    try {
      const { error } = await supabase.from('leads').insert([{
        vendor_id: data.vendors.id,
        title: data.name,
        product_name: data.name,
        product_interest: data.name,
        description: data.description?.replace(/<[^>]*>/g, '') || '',
        category: data.micro_categories?.name || 'General',
        category_slug: data.micro_categories?.slug || '',
        status: 'AVAILABLE',
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;
      
      toast({ title: 'Enquiry Sent', description: 'Your enquiry has been submitted to the vendor' });
      navigate(`/directory/vendor/${data.vendors.id}`);
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({ title: 'Error', description: 'Failed to send enquiry', variant: 'destructive' });
    }
  };

  const handleCompanyClick = () => {
    if (data?.vendors?.id) {
      navigate(`/directory/vendor/${data.vendors.id}`);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        // First try to load by slug
        const res = await directoryApi.getProductDetailBySlug(productSlug);
        setData(res);
        if (res?.status === 'DRAFT') {
          setIsDraft(true);
        }
      } catch (slugError) { 
        console.warn('Slug lookup failed, trying ID:', slugError);
        // Fallback: try loading by ID (in case slug is actually an ID)
        try {
          const { data: product, error } = await supabase
            .from('products')
            .select(`
              *,
              vendors (*)
            `)
            .eq('id', productSlug)
            .single();
          
          if (!error && product) {
            // Get category and meta separately if needed
            if (product.micro_category_id) {
              const { data: catData } = await supabase
                .from('micro_categories')
                .select(`
                  id, name, slug,
                  sub_categories (
                    id, name, slug,
                    head_categories (id, name, slug)
                  )
                `)
                .eq('id', product.micro_category_id)
                .single();
              if (catData) {
                product.micro_categories = catData;
                
                // Fetch meta tags from micro_category_meta table
                const { data: metaData } = await supabase
                  .from('micro_category_meta')
                  .select('meta_tags, description')
                  .eq('micro_categories', product.micro_category_id)
                  .single();
                if (metaData) {
                  product.meta_tags = metaData.meta_tags;
                  product.meta_description = metaData.description;
                }
              }
            }
            setData(product);
            if (product?.status === 'DRAFT') {
              setIsDraft(true);
            }
          } else {
            console.error('Product not found by ID or slug');
          }
        } catch (idError) {
          console.error('ID lookup also failed:', idError);
        }
      } finally { 
        setLoading(false); 
      }
    };
    if (productSlug) load();
  }, [productSlug]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;
  if (!data) return <div className="p-10 text-center">Product not found</div>;

  const { vendors: vendor, micro_categories: cat } = data;
  const images = data.images || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
       <Helmet>
         <title>{data.meta_tags || `${data.name} | ${cat?.name || 'Product'} | IndianTradeMart`}</title>
         <meta name="description" content={data.meta_description || data.description?.replace(/<[^>]*>/g, '').substring(0, 160) || data.name} />
         <meta name="keywords" content={`${data.name}, ${cat?.name || ''}, ${cat?.sub_categories?.name || ''}, ${vendor?.company_name || ''}`} />
         <meta property="og:title" content={data.name} />
         <meta property="og:description" content={data.meta_description || data.description?.replace(/<[^>]*>/g, '').substring(0, 160) || data.name} />
         {images[0] && <meta property="og:image" content={images[0]} />}
         <meta property="og:url" content={shareUtils.getCurrentUrl()} />
       </Helmet>
       {isDraft && (
         <div className="bg-yellow-50 border-b border-yellow-200 py-3 px-4 mb-0 shadow-sm">
           <div className="container mx-auto text-sm text-yellow-800 flex items-center gap-2">
             <span className="font-semibold">⚠️ Draft Product:</span> This product is in draft status and not visible to other buyers.
           </div>
         </div>
       )}
       <div className="bg-white border-b py-3 px-4 mb-4 shadow-sm">
           <div className="container mx-auto text-sm text-gray-500 flex flex-wrap gap-1">
               <Link to="/directory">Directory</Link> {' › '}
               {cat ? (
                  <>
                    <span>{cat.sub_categories?.head_categories?.name}</span> {' › '}
                    <span>{cat.sub_categories?.name}</span> {' › '}
                    <Link to={`/directory/${cat.sub_categories?.head_categories?.slug}/${cat.sub_categories?.slug}/${cat.slug}`} className="text-blue-600 font-medium">{cat.name}</Link>
                  </>
               ) : (
                  <span>{data.category_other || 'Uncategorized'}</span>
               )}
           </div>
       </div>

       <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
           {/* Left: Gallery */}
           <div className="md:col-span-1 space-y-4">
               <div className="aspect-square bg-white rounded-lg border overflow-hidden flex items-center justify-center p-2 shadow-sm">
                   {images[activeImage] ? (
                       <img src={images[activeImage]} alt={data.name} className="max-w-full max-h-full object-contain" />
                   ) : (
                       <div className="text-gray-300">No Image</div>
                   )}
               </div>
               <div className="flex gap-2 overflow-x-auto pb-2">
                   {images.map((img, i) => (
                       <div 
                         key={i} 
                         onClick={() => setActiveImage(i)}
                         className={`w-16 h-16 border rounded cursor-pointer shrink-0 overflow-hidden ${activeImage === i ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
                       >
                           <img src={img} className="w-full h-full object-cover" alt="" />
                       </div>
                   ))}
               </div>
           </div>

           {/* Center: Info */}
           <div className="md:col-span-1 space-y-4">
               <div>
                   <div className="flex justify-between items-start gap-4 mb-2">
                       <h1 className="text-3xl font-bold text-slate-900">{data.name}</h1>
                       {/* Share Buttons */}
                       <div className="flex gap-1 flex-wrap justify-end">
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-green-50" asChild>
                               <a href={shareUtils.getWhatsAppUrl(data.name, shareUtils.getCurrentUrl())} target="_blank" rel="noopener noreferrer" title="Share on WhatsApp">
                                   <MessageCircle className="w-4 h-4 text-green-600" />
                               </a>
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-50" asChild>
                               <a href={shareUtils.getFacebookUrl(shareUtils.getCurrentUrl())} target="_blank" rel="noopener noreferrer" title="Share on Facebook">
                                   <Facebook className="w-4 h-4 text-blue-600" />
                               </a>
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-100" asChild>
                               <a href={shareUtils.getLinkedInUrl(shareUtils.getCurrentUrl(), data.name)} target="_blank" rel="noopener noreferrer" title="Share on LinkedIn">
                                   <Linkedin className="w-4 h-4 text-blue-700" />
                               </a>
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-sky-50" asChild>
                               <a href={shareUtils.getTwitterUrl(data.name, shareUtils.getCurrentUrl())} target="_blank" rel="noopener noreferrer" title="Share on Twitter">
                                   <Twitter className="w-4 h-4 text-sky-500" />
                               </a>
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gray-100" onClick={handleCopyLink} title="Copy link">
                               {copied ? <Check className="w-4 h-4 text-green-600" /> : <LinkIcon className="w-4 h-4 text-gray-600" />}
                           </Button>
                       </div>
                   </div>
                   <div className="text-2xl font-bold text-[#003D82]">
                       ₹{data.price} <span className="text-base font-normal text-slate-500">/ {data.price_unit}</span>
                   </div>
                   {data.min_order_qty && (
                      <div className="text-sm text-gray-500 mt-1">Min Order: {data.min_order_qty} {data.qty_unit}</div>
                   )}
               </div>

               <div className="prose prose-sm max-w-none text-slate-600 bg-white p-4 rounded border" dangerouslySetInnerHTML={{ __html: data.description || 'No description available.' }} />

               {/* Specs */}
               {data.specifications && data.specifications.length > 0 && (
                   <div className="bg-white rounded border p-4 shadow-sm">
                       <h3 className="font-bold mb-3 text-sm uppercase text-gray-500 border-b pb-2">Product Specifications</h3>
                       <div className="space-y-2 text-sm">
                           {data.specifications.map((s, i) => (
                               <div key={i} className="flex justify-between pb-1">
                                   <span className="text-slate-500">{s.key}</span>
                                   <span className="font-medium text-slate-900">{s.value}</span>
                               </div>
                           ))}
                       </div>
                   </div>
               )}

               <div className="flex gap-3">
                   {data.pdf_url && (
                       <a href={data.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 px-3 py-2 rounded hover:bg-blue-50 bg-white shadow-sm">
                           <FileText className="w-4 h-4"/> Product Brochure
                       </a>
                   )}
                   {data.video_url && (
                       <a href={data.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-red-600 border border-red-200 px-3 py-2 rounded hover:bg-red-50 bg-white shadow-sm">
                           <PlayCircle className="w-4 h-4"/> Watch Video
                       </a>
                   )}
               </div>
           </div>

           {/* Right: Vendor Card */}
           <div className="md:col-span-1">
               <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6 sticky top-20 h-fit">
                   <div className="flex items-start gap-4 mb-4">
                       <div className="w-16 h-16 rounded border bg-slate-50 flex items-center justify-center overflow-hidden">
                           {vendor.profile_image ? <img src={vendor.profile_image} className="w-full h-full object-cover"/> : <span className="text-xl font-bold text-slate-300">{vendor.company_name?.[0]}</span>}
                       </div>
                       <div>
                           <h3 onClick={handleCompanyClick} className="font-bold text-lg text-slate-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors">{vendor.company_name}</h3>
                           <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                               <MapPin className="w-3 h-3"/> {vendor.city}, {vendor.state}
                           </div>
                           {vendor.verification_badge && (
                               <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none mt-2 h-5 px-2">
                                   <CheckCircle className="w-3 h-3 mr-1"/> Verified Supplier
                               </Badge>
                           )}
                       </div>
                   </div>

                   <div className="space-y-3 mb-6">
                       <div className="flex items-center gap-3 text-sm">
                           <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Phone className="w-4 h-4"/></div>
                           <span className="font-medium text-slate-900">
                             {showFullPhone ? vendor.phone : phoneUtils.maskPhone(vendor.phone)}
                           </span>
                       </div>
                       {/* Email hidden/masked usually */}
                   </div>

                   <Button onClick={handleSendEnquiry} className="w-full bg-[#003D82] h-12 text-lg mb-3 hover:bg-blue-800">Send Enquiry</Button>
                   <Button 
                     variant="outline" 
                     className="w-full"
                     onClick={() => setShowFullPhone(!showFullPhone)}
                   >
                     {showFullPhone ? 'Hide Phone Number' : 'View Phone Number'}
                   </Button>
               </div>
           </div>
       </div>
    </div>
  );
};

export default ProductDetail;