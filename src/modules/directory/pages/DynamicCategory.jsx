
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { categoryApi } from '@/modules/directory/services/categoryApi';
import PillBreadcrumbs from '@/shared/components/PillBreadcrumbs';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';
import { Loader2, Folder, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DynamicCategory = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const catData = await categoryApi.getCategoryBySlug(slug);
      
      if (catData) {
        setCategory(catData);
        
        // Only fetch children if it's a HEAD or SUB category
        if (catData.type === 'HEAD' || catData.type === 'SUB') {
            const childrenData = await categoryApi.getCategoryChildren(catData.id, catData.type);
            setChildren(childrenData || []);
        } else {
            setChildren([]);
        }
      }
      setLoading(false);
    };

    if (slug) fetchData();
  }, [slug]);

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00A699]" /></div>;
  }

  if (!category) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h2 className="text-2xl font-bold mb-4">Category Not Found</h2>
            <Button onClick={() => navigate('/categories')}>Browse All Categories</Button>
        </div>
    );
  }

  const hasChildren = children && children.length > 0;

  return (
    <>
      <Helmet>
        <title>{category.name} - IndianTradeMart</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b py-6">
          <div className="container mx-auto px-4">
            <PillBreadcrumbs className="mb-4" />

            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900">
              {category.name}
            </h1>
            <p className="text-gray-500 text-lg">
              {hasChildren ? `Select a ${category.type === 'HEAD' ? 'sub-category' : 'micro-category'}` : `Browse verified suppliers & products`}
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
           {hasChildren ? (
               <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                   {children.map(child => (
                       <Link 
                           key={child.id} 
                           to={`/categories/${child.slug}`}
                           className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-[#00A699] transition-all group"
                       >
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                   <Folder className="w-5 h-5 text-[#00A699]" />
                                   <span className="font-medium text-gray-800">{child.name}</span>
                               </div>
                               <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#00A699]" />
                           </div>
                       </Link>
                   ))}
               </div>
           ) : (
               /* Leaf Node (Micro Category) - Show Products/Vendors */
               <SearchResultsList 
                 filters={{ priceRange: [0, 1000000], rating: 0, verified: false, inStock: false }} 
                 query="" 
                 city="" 
                 category={category.name} 
               />
           )}
        </div>
      </div>
    </>
  );
};

export default DynamicCategory;
