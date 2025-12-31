import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { ChevronRight, Home, Loader2 } from 'lucide-react';

const MicroCategoryPage = () => {
  const { headSlug, subSlug } = useParams();
  const [micros, setMicros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await directoryApi.getMicroCategories(subSlug);
        setMicros(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if(subSlug) load();
  }, [subSlug]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-white border-b py-4">
        <div className="container mx-auto px-4">
            <nav className="flex text-sm text-gray-500 mb-4 items-center flex-wrap">
               <Link to="/directory" className="hover:text-blue-700 flex items-center"><Home className="w-3 h-3 mr-1"/> Directory</Link>
               <ChevronRight className="w-4 h-4 mx-2" />
               <Link to={`/directory/${headSlug}`} className="hover:text-blue-700 capitalize">{headSlug?.replace(/-/g, ' ')}</Link>
               <ChevronRight className="w-4 h-4 mx-2" />
               <span className="font-semibold text-gray-900 capitalize">{subSlug?.replace(/-/g, ' ')}</span>
            </nav>
            <h1 className="text-3xl font-bold text-slate-900 capitalize">{subSlug?.replace(/-/g, ' ')}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
         {loading ? <Loader2 className="animate-spin mx-auto"/> : (
             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {micros.map(m => (
                     <Link key={m.id} to={`/directory/${headSlug}/${subSlug}/${m.slug}`} className="bg-white p-5 rounded-lg border hover:border-blue-500 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start">
                           <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-700">{m.name}</h3>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">View Products →</div>
                     </Link>
                 ))}
                 {micros.length === 0 && <div className="col-span-full text-center text-gray-500 py-10">No categories found.</div>}
             </div>
         )}
      </div>
    </div>
  );
};

export default MicroCategoryPage;