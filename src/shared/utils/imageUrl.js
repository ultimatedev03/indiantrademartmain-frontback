const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const safeUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

export const optimizeImageUrl = (value, options = {}) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const url = safeUrl(raw);
  if (!url) return raw;

  const width = toNumber(options.width);
  const height = toNumber(options.height);
  const quality = toNumber(options.quality) || 72;
  const host = String(url.hostname || '').toLowerCase();

  if (host.includes('images.unsplash.com')) {
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    if (width) url.searchParams.set('w', String(width));
    if (height) url.searchParams.set('h', String(height));
    url.searchParams.set('q', String(quality));
    return url.toString();
  }

  if (host.includes('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
    url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    if (width) url.searchParams.set('width', String(width));
    if (height) url.searchParams.set('height', String(height));
    url.searchParams.set('quality', String(quality));
    return url.toString();
  }

  return raw;
};
