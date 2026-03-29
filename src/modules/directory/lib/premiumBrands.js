import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

const normalizeBrandSlug = (value = '') => String(value || '').trim().toLowerCase();
const normalizeVendorSlug = (value = '') => String(value || '').trim().toLowerCase();

export const PREMIUM_BRANDS = [
  {
    id: 'pdce',
    name: 'PDCE',
    slug: 'pdce',
    logo_url: 'https://eimager.com/images/pdce-new.png',
    vendorSlug: 'pdce-sristech-testing-and-research-laboratory-pvt-ltd',
    tagline: 'Testing, research, and quality assurance solutions.',
    description:
      'PDCE is featured as a premium brand for laboratory, testing, and compliance-focused business requirements.',
    primaryBusinessType: 'Testing and Research Services',
    highlights: ['Testing Services', 'Research Support', 'Quality Assurance'],
  },
  {
    id: 'bsh',
    name: 'BSH',
    slug: 'bsh',
    logo_url: 'https://eimager.com/images/bsh.png',
    vendorSlug: 'bsh-infra-private-limited',
    tagline: 'Infrastructure-focused project and execution partner.',
    description:
      'BSH is featured for infrastructure-oriented solutions, project support, and execution-led business services.',
    primaryBusinessType: 'Infrastructure Solutions',
    highlights: ['Infrastructure', 'Project Execution', 'Business Services'],
  },
  {
    id: 'bsh-realty',
    name: 'BSH Realty',
    slug: 'bsh-realty',
    logo_url: 'https://eimager.com/images/bshrealty.png',
    vendorSlug: 'bsh-reality-private-limited',
    tagline: 'Real-estate and property development brand.',
    description:
      'BSH Realty is highlighted for property development, real-estate support, and project consulting services.',
    primaryBusinessType: 'Real Estate Services',
    highlights: ['Real Estate', 'Property Services', 'Project Consulting'],
  },
  {
    id: 'ultimate-itech',
    name: 'Ultimate Itech',
    slug: 'ultimate-itech',
    logo_url: 'https://eimager.com/images/ultimate-new.png',
    vendorSlug: 'ultimate-itech-private-limited',
    tagline: 'Technology-enabled business support and digital services.',
    description:
      'Ultimate Itech is a premium brand for digital, technology, and enterprise support requirements.',
    primaryBusinessType: 'Technology Services',
    highlights: ['Digital Services', 'Enterprise Support', 'Technology'],
  },
  {
    id: 'startup',
    name: 'Startup',
    slug: 'startup',
    logo_url: 'https://eimager.com/images/startup.png',
    vendorSlug: 'startup-and-business-india',
    tagline: 'Startup enablement and business growth support.',
    description:
      'Startup is featured for business setup, growth support, and startup-focused service requirements.',
    primaryBusinessType: 'Startup and Business Services',
    highlights: ['Business Setup', 'Growth Support', 'Startup Services'],
  },
  {
    id: 'movie',
    name: 'Movie',
    slug: 'movie',
    logo_url: 'https://eimager.com/images/movie-image.png',
    vendorSlug: 'sristech-movies-private-limited',
    tagline: 'Creative media and production-oriented solutions.',
    description:
      'Movie is highlighted for media production, content support, and creative business services.',
    primaryBusinessType: 'Media and Production Services',
    highlights: ['Media', 'Production', 'Creative Services'],
  },
  {
    id: 'sres-tech',
    name: 'SRES Tech',
    slug: 'sres-tech',
    logo_url: 'https://eimager.com/images/sres-tech.png',
    vendorSlug: 'sristech-designers-and-consultants-private-limited',
    tagline: 'Design, consulting, and technology-led execution.',
    description:
      'SRES Tech is featured for design support, consulting, and technology-enabled service delivery.',
    primaryBusinessType: 'Design and Consulting Services',
    highlights: ['Design', 'Consulting', 'Technology Support'],
  },
  {
    id: 'pss-lab',
    name: 'PSS Lab',
    slug: 'pss-lab',
    logo_url: 'https://eimager.com/images/pss-lab-now.png',
    vendorSlug: 'pdce-sristech-testing-and-research-laboratory-pvt-ltd',
    tagline: 'Laboratory evaluation and quality testing support.',
    description:
      'PSS Lab is featured for lab testing, product evaluation, and quality-check workflows.',
    primaryBusinessType: 'Laboratory Testing Services',
    highlights: ['Lab Testing', 'Product Evaluation', 'Quality Checks'],
  },
];

const PREMIUM_BRANDS_BY_VENDOR_SLUG = PREMIUM_BRANDS.reduce((map, brand) => {
  const vendorSlug = normalizeVendorSlug(brand.vendorSlug);
  if (!vendorSlug) return map;

  const list = map.get(vendorSlug) || [];
  list.push(brand);
  map.set(vendorSlug, list);
  return map;
}, new Map());

export const getPremiumBrandBySlug = (slug = '') =>
  PREMIUM_BRANDS.find((brand) => brand.slug === normalizeBrandSlug(slug)) || null;

export const getPremiumBrandsByVendorSlug = (vendorSlug = '') =>
  PREMIUM_BRANDS_BY_VENDOR_SLUG.get(normalizeVendorSlug(vendorSlug)) || [];

export const getPremiumBrandByVendorSlug = (vendorSlug = '') => {
  const matches = getPremiumBrandsByVendorSlug(vendorSlug);
  return matches.length === 1 ? matches[0] : null;
};

export const getPremiumBrandTargetPath = (slug = '') => {
  const brand = getPremiumBrandBySlug(slug);
  if (!brand?.vendorSlug) return '/directory/vendor';
  const basePath = getVendorProfilePath({ slug: brand.vendorSlug }) || '/directory/vendor';
  return `${basePath}?brand=${encodeURIComponent(brand.slug)}`;
};
