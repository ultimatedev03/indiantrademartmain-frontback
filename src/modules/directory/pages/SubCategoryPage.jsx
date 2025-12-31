
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { ChevronRight, Home, Loader2 } from 'lucide-react';

const SubCategoryPage = () => {
  const { headSlug } = useParams();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await directoryApi.getSubCategories(headSlug);
        setSubs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if(headSlug) load();
  }, [headSlug]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-white border-b py-4">
        <div className="container mx-auto px-4">
            <nav className="flex text-sm text-gray-500 mb-4 items-center">
               <Link to="/directory" className="hover:text-blue-700 flex items-center"><Home className="w-3 h-3 mr-1"/> Directory</Link>
               <ChevronRight className="w-4 h-4 mx-2" />
               <span className="font-semibold text-gray-900 capitalize">{headSlug?.replace(/-/g, ' ')}</span>
            </nav>
            <h1 className="text-3xl font-bold text-slate-900 capitalize">{headSlug?.replace(/-/g, ' ')}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
         {loading ? <Loader2 className="animate-spin mx-auto"/> : (
             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {subs.map(sub => (
                     <Link key={sub.id} to={`/directory/${headSlug}/${sub.slug}`} className="bg-white p-5 rounded-lg border hover:border-blue-500 hover:shadow-md transition-all">
                        <h3 className="font-bold text-gray-800 mb-1">{sub.name}</h3>
                        <div className="text-xs text-gray-500">View Categories →</div>
                     </Link>
                 ))}
                 {subs.length === 0 && <div className="col-span-full text-center text-gray-500 py-10">No sub-categories found.</div>}
             </div>
         )}
      </div>
    </div>
  );
};

export default SubCategoryPage;
