import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const PREMIUM_BRANDS = [
  { id: 'pdce', name: 'PDCE', slug: 'pdce', logo_url: 'https://eimager.com/images/pdce-new.png' },
  { id: 'bsh', name: 'BSH', slug: 'bsh', logo_url: 'https://eimager.com/images/bsh.png' },
  { id: 'bsh-realty', name: 'BSH Realty', slug: 'bsh-realty', logo_url: 'https://eimager.com/images/bshrealty.png' },
  { id: 'ultimate itech', name: 'Ultimate Itech', slug: 'ultimate-itech', logo_url: 'https://eimager.com/images/ultimate-new.png' },
  { id: 'startup', name: 'Startup', slug: 'startup', logo_url: 'https://eimager.com/images/startup.png' },
  { id: 'movie', name: 'Movie', slug: 'movie', logo_url: 'https://eimager.com/images/movie-image.png' },
  { id: 'sres-tech', name: 'SRES Tech', slug: 'sres-tech', logo_url: 'https://eimager.com/images/sres-tech.png' },
  { id: 'pss-lab', name: 'PSS Lab', slug: 'pss-lab', logo_url: 'https://eimager.com/images/pss-lab-now.png' },
];

const PremiumBrandsSection = () => {
  const navigate = useNavigate();
  const items = useMemo(() => [...PREMIUM_BRANDS, ...PREMIUM_BRANDS], []);

  return (
    <section className="py-16 bg-gray-50 border-t border-gray-100 overflow-x-hidden min-h-[228px]">
      <style>{`
        @keyframes brand-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-wrap {
          overflow: hidden;
          width: 100%;
          position: relative;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: brand-marquee 35s linear infinite;
          will-change: transform;
        }
        .marquee-wrap:hover .marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; transform: translateX(0); }
        }
      `}</style>

      <div className="container mx-auto px-4 overflow-x-hidden">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">
            Explore products from <span className="text-[#4F46E5]">Premium Brands</span>
          </h2>
        </div>

        <div className="marquee-wrap">
          <div className="marquee-track gap-2 items-center py-1">
            {items.map((brand, idx) => (
              <button
                type="button"
                key={`${brand.id}-${idx}`}
                className="flex-none w-44 md:w-48 lg:w-52 h-24 md:h-28 lg:h-32 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-300 border-0 bg-transparent p-0"
                title={brand.name}
                aria-label={`Open ${brand.name} brand page`}
                onClick={() => navigate(`/directory/brand/${brand.slug}`)}
              >
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  width="208"
                  height="112"
                  sizes="(min-width: 1024px) 208px, (min-width: 768px) 192px, 176px"
                  className="max-h-20 md:max-h-24 lg:max-h-28 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PremiumBrandsSection;
