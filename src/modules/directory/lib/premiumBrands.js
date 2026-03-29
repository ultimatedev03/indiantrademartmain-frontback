import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

export const PREMIUM_BRANDS = [
  {
    id: 'pdce',
    name: 'PDCE',
    slug: 'pdce',
    logo_url: 'https://eimager.com/images/pdce-new.png',
    vendorSlug: 'pdce-sristech-testing-and-research-laboratory-pvt-ltd',
  },
  {
    id: 'bsh',
    name: 'BSH',
    slug: 'bsh',
    logo_url: 'https://eimager.com/images/bsh.png',
    vendorSlug: 'bsh-infra-private-limited',
  },
  {
    id: 'bsh-realty',
    name: 'BSH Realty',
    slug: 'bsh-realty',
    logo_url: 'https://eimager.com/images/bshrealty.png',
    vendorSlug: 'bsh-reality-private-limited',
  },
  {
    id: 'ultimate-itech',
    name: 'Ultimate Itech',
    slug: 'ultimate-itech',
    logo_url: 'https://eimager.com/images/ultimate-new.png',
    vendorSlug: 'ultimate-itech-private-limited',
  },
  {
    id: 'startup',
    name: 'Startup',
    slug: 'startup',
    logo_url: 'https://eimager.com/images/startup.png',
    vendorSlug: 'startup-and-business-india',
  },
  {
    id: 'movie',
    name: 'Movie',
    slug: 'movie',
    logo_url: 'https://eimager.com/images/movie-image.png',
    vendorSlug: 'sristech-movies-private-limited',
  },
  {
    id: 'sres-tech',
    name: 'SRES Tech',
    slug: 'sres-tech',
    logo_url: 'https://eimager.com/images/sres-tech.png',
    vendorSlug: 'sristech-designers-and-consultants-private-limited',
  },
  {
    id: 'pss-lab',
    name: 'PSS Lab',
    slug: 'pss-lab',
    logo_url: 'https://eimager.com/images/pss-lab-now.png',
    vendorSlug: 'pdce-sristech-testing-and-research-laboratory-pvt-ltd',
  },
];

export const getPremiumBrandBySlug = (slug = '') =>
  PREMIUM_BRANDS.find((brand) => brand.slug === String(slug || '').trim().toLowerCase()) || null;

export const getPremiumBrandTargetPath = (slug = '') => {
  const brand = getPremiumBrandBySlug(slug);
  if (!brand?.vendorSlug) return '/directory/vendor';
  return getVendorProfilePath({ slug: brand.vendorSlug }) || '/directory/vendor';
};
