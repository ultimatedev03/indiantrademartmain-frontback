// src/modules/directory/components/PremiumBrandsSection.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const HARD_CODED_BRANDS = [
  {
    id: "pdce",
    name: "PDCE",
    slug: "pdce",
    logo_url: "https://eimager.com/images/pdce-new.png",
  },
  {
    id: "bsh",
    name: "BSH",
    slug: "bsh",
    logo_url: "https://eimager.com/images/bsh.png",
  },
  {
    id: "bsh-realty",
    name: "BSH Realty",
    slug: "bsh-realty",
    logo_url: "https://eimager.com/images/bshrealty.png",
  },
  {
    id: "ultimate itech",
    name: "Ultimate Itech",
    slug: "ultimate-itech",
    logo_url: "https://eimager.com/images/ultimate-new.png",
  },
  {
    id: "startup",
    name: "Startup",
    slug: "startup",
    logo_url: "https://eimager.com/images/startup.png",
  },
  {
    id: "movie",
    name: "Movie",
    slug: "movie",
    logo_url: "https://eimager.com/images/movie-image.png",
  },
  {
    id: "sres-tech",
    name: "SRES Tech",
    slug: "sres-tech",
    logo_url: "https://eimager.com/images/sres-tech.png",
  },
  {
    id: "pss-lab",
    name: "PSS Lab",
    slug: "pss-lab",
    logo_url: "https://eimager.com/images/pss-lab-now.png",
  },
];

const PremiumBrandsSection = () => {
  const navigate = useNavigate();

  // ✅ Hardcoded brands (no API)
  const brands = HARD_CODED_BRANDS;

  const [repeatCount, setRepeatCount] = useState(1);
  const wrapRef = useRef(null);
  const unitRef = useRef(null);

  // ✅ Logo size controlled (so huge images don't break spacing)
  const logoClass =
    "max-h-12 md:max-h-14 lg:max-h-16 max-w-[170px] md:max-w-[190px] lg:max-w-[210px] " +
    "w-auto object-contain transition-all";

  /**
   * ✅ MAIN FIX: remove fixed tile width (w-56 etc)
   * Because w-56 creates big empty space inside each tile when logo is smaller.
   * Now tile width is content-based with padding.
   */
  const tileClass =
    "flex-none h-20 md:h-24 lg:h-28 " +
    "px-6 md:px-8 lg:px-10 " +
    "flex items-center justify-center " +
    "cursor-pointer hover:scale-105 transition-transform duration-300";

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

    const raf = requestAnimationFrame(computeRepeats);
    window.addEventListener("resize", computeRepeats);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", computeRepeats);
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
    return `${Math.max(35, n * 2.2)}s`; // a bit faster than before but smooth
  }, [baseBrands]);

  const BrandLogo = ({ brand }) => {
    const [imgOk, setImgOk] = useState(true);

    if (brand?.logo_url && imgOk) {
      return (
        <img
          alt={`${brand.name} Logo`}
          className={logoClass}
          src={brand.logo_url}
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      );
    }

    return (
      <span className="font-bold text-gray-500 whitespace-nowrap">
        {brand?.name}
      </span>
    );
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
            Explore products from{" "}
            <span className="text-[#4F46E5]">Premium Brands</span>
          </h2>
        </div>

        {/* ✅ Measuring row: doesn't affect layout */}
        <div
          ref={unitRef}
          className="fixed left-0 top-0 invisible pointer-events-none -z-10"
          style={{ width: 0, height: 0, overflow: "hidden" }}
        >
          <div className="flex items-center gap-4 md:gap-6">
            {brands.map((brand) => (
              <div key={`unit-${brand.id}`} className={tileClass}>
                <BrandLogo brand={brand} />
              </div>
            ))}
          </div>
        </div>

        <div className="marquee-wrap" ref={wrapRef}>
          <div
            className="marquee-track items-center py-2 gap-4 md:gap-6"
            style={{ ["--duration"]: durationSeconds }}
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
