import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/services/directoryApi';

const PremiumBrandsSection = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);

  const [repeatCount, setRepeatCount] = useState(1);
  const wrapRef = useRef(null);
  const unitRef = useRef(null);

  useEffect(() => {
    const loadBrands = async () => {
      const data = await directoryApi.getBrands();
      setBrands(data || []);
    };
    loadBrands();
  }, []);

  const logoClass =
    'max-h-16 md:max-h-20 lg:max-h-24 w-auto object-contain hover:grayscale-0 transition-all';

  const tileClass =
    'flex-none w-56 md:w-64 lg:w-72 h-24 md:h-28 lg:h-32 ' +
    'flex items-center justify-center ' +
    'cursor-pointer hover:scale-110 transition-transform duration-300';

  // ✅ compute repeat count based on actual measured width of ONE set
  useEffect(() => {
    if (!brands?.length) return;

    const computeRepeats = () => {
      const wrapEl = wrapRef.current;
      const unitEl = unitRef.current;
      if (!wrapEl || !unitEl) return;

      const wrapWidth = wrapEl.clientWidth || 0;
      const unitWidth = unitEl.scrollWidth || 0;

      if (!wrapWidth || !unitWidth) return;

      // Ensure one full set > viewport width (add +1 buffer)
      const needed = Math.max(1, Math.ceil(wrapWidth / unitWidth) + 1);
      setRepeatCount(needed);
    };

    // run after DOM paints so scrollWidth is accurate
    const raf = requestAnimationFrame(computeRepeats);

    window.addEventListener('resize', computeRepeats);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', computeRepeats);
    };
  }, [brands]);

  const baseBrands = useMemo(() => {
    if (!brands?.length) return [];
    const out = [];
    for (let i = 0; i < repeatCount; i++) out.push(...brands);
    return out;
  }, [brands, repeatCount]);

  const duplicatedBrands = useMemo(() => {
    if (!baseBrands.length) return [];
    return [...baseBrands, ...baseBrands];
  }, [baseBrands]);

  const durationSeconds = useMemo(() => {
    const n = baseBrands?.length || 0;
    return `${Math.max(40, n * 2.5)}s`; // slower (increase 40 -> slower)
  }, [baseBrands]);

  const BrandLogo = ({ brand }) => {
    const name = (brand?.name || '').toUpperCase();

    const isPlaceholder =
      typeof brand?.logo_url === 'string' &&
      brand.logo_url.toLowerCase().includes('example.com');

    // ✅ Prefer DB logo_url (if not placeholder)
    if (brand?.logo_url && !isPlaceholder) {
      return (
        <img
          alt={`${brand.name} Logo`}
          className={logoClass}
          src={brand.logo_url}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }

    // ✅ fallback: show brand text if no usable logo_url
    return <span className="font-bold text-gray-500">{brand?.name}</span>;
  };

  return (
    <section className="py-16 bg-gray-50 border-t border-gray-100 overflow-x-hidden">
      <style>{`
        @keyframes brand-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-wrap {
          overflow: hidden;
          position: relative;
          width: 100%;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: brand-marquee var(--duration, 30s) linear infinite;
          will-change: transform;
        }
        .marquee-wrap:hover .marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
            transform: translateX(0);
          }
        }
      `}</style>

      <div className="container mx-auto px-4 overflow-x-hidden">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">
            Explore products from <span className="text-[#4F46E5]">Premium Brands</span>
          </h2>
        </div>

        {/* ✅ Measuring row: fixed + width 0 so it NEVER affects page scroll */}
        <div
          ref={unitRef}
          className="fixed left-0 top-0 invisible pointer-events-none -z-10"
          style={{ width: 0, height: 0, overflow: 'hidden' }}
        >
          <div className="flex gap-3 items-center">
            {brands.map((brand) => (
              <div key={`unit-${brand.id}`} className={tileClass}>
                <BrandLogo brand={brand} />
              </div>
            ))}
          </div>
        </div>

        <div className="marquee-wrap" ref={wrapRef}>
          <div
            className="marquee-track gap-3 items-center py-2"
            style={{ ['--duration']: durationSeconds }}
          >
            {duplicatedBrands.map((brand, idx) => (
              <div
                key={`${brand.id}-${idx}`}
                onClick={() => navigate(`/directory/brand/${brand.slug}`)}
                className={tileClass}
                title={brand.name}
              >
                <BrandLogo brand={brand} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PremiumBrandsSection;