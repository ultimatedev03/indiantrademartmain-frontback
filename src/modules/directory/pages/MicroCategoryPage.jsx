import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { ChevronRight, Home, Image as ImageIcon, Loader2 } from 'lucide-react';

const safeImg = (url) => (typeof url === 'string' && url.trim().length > 0 ? url.trim() : null);

const MicroCategoryCard = ({ headSlug, subSlug, micro, coverUrl }) => {
  const img = safeImg(coverUrl);

  return (
    <Link
      to={`/directory/${headSlug}/${subSlug}/${micro.slug}`}
      className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all overflow-hidden group"
    >
      <div className="h-36 bg-slate-50 overflow-hidden flex items-center justify-center">
        {img ? (
          <img
            src={img}
            alt={micro.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-extrabold text-slate-900 mb-1 group-hover:text-blue-700 line-clamp-2">
          {micro.name}
        </h3>
        <div className="text-xs text-slate-500 mt-2">View Products →</div>
      </div>
    </Link>
  );
};

const MicroCategoryPage = () => {
  const { headSlug, subSlug } = useParams();
  const [micros, setMicros] = useState([]);
  const [covers, setCovers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await directoryApi.getMicroCategories(subSlug, headSlug);
        setMicros(data || []);

        const ids = (data || []).map((m) => m.id).filter(Boolean);
        const coverMap = await directoryApi.getMicroCategoryCovers(ids);
        setCovers(coverMap || {});
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (subSlug) load();
  }, [subSlug, headSlug]);

  const title = useMemo(() => (subSlug || '').replace(/-/g, ' ').trim(), [subSlug]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-white border-b py-4">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm text-gray-500 mb-4 items-center flex-wrap">
            <Link to="/directory" className="hover:text-blue-700 flex items-center">
              <Home className="w-3 h-3 mr-1" /> Directory
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <Link to={`/directory/${headSlug}`} className="hover:text-blue-700 capitalize">
              {headSlug?.replace(/-/g, ' ')}
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="font-semibold text-gray-900 capitalize">{title}</span>
          </nav>

          <h1 className="text-3xl font-extrabold text-slate-900 capitalize">{title}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {micros.map((m) => (
              <MicroCategoryCard
                key={m.id}
                headSlug={headSlug}
                subSlug={subSlug}
                micro={m}
                coverUrl={covers?.[m.id]}
              />
            ))}

            {micros.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-10">No categories found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MicroCategoryPage;
