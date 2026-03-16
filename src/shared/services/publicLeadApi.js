import { supabase } from '@/lib/customSupabaseClient';

const stripUndefined = (payload = {}) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const sortKeys = (payload = {}) =>
  Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

const columnFromMissingError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`.trim();
  const match =
    raw.match(/column\s+"([^"]+)"/i) ||
    raw.match(/column\s+'([^']+)'/i) ||
    raw.match(/find\s+the\s+'([^']+)'\s+column/i) ||
    raw.match(/find\s+the\s+"([^"]+)"\s+column/i);

  return String(match?.[1] || '').trim();
};

const isMissingColumnError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    String(error?.code || '').toUpperCase() === '42703' ||
    raw.includes('does not exist') ||
    raw.includes('schema cache')
  );
};

const buildMinimalLeadPayload = (payload = {}) =>
  stripUndefined({
    title: payload.title || payload.product_name || payload.category || 'New enquiry',
    product_name: payload.product_name || payload.title || payload.category || 'General enquiry',
    category: payload.category || 'General',
    quantity: payload.quantity || null,
    budget: payload.budget ?? 0,
    location: payload.location || 'India',
    buyer_name: payload.buyer_name || 'Buyer',
    buyer_email: payload.buyer_email || '',
    buyer_phone: payload.buyer_phone || '',
    company_name: payload.company_name || null,
    product_interest: payload.product_interest || payload.product_name || payload.title || 'General',
    message: payload.message || payload.description || payload.title || 'New enquiry',
    status: payload.status || 'AVAILABLE',
    created_at: payload.created_at || new Date().toISOString(),
  });

export const normalizeIndianPhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
};

export const isValidIndianPhone = (value) => /^[6-9]\d{9}$/.test(normalizeIndianPhone(value));

export const submitPublicLead = async (leadPayload = {}) => {
  const attempts = [stripUndefined({ ...leadPayload })];
  const minimalPayload = buildMinimalLeadPayload(leadPayload);
  attempts.push(minimalPayload);
  attempts.push(
    stripUndefined({
      ...minimalPayload,
      category: undefined,
      location: undefined,
      company_name: undefined,
    })
  );

  const seen = new Set();
  let lastError = null;

  while (attempts.length) {
    const payload = attempts.shift();
    const signature = JSON.stringify(sortKeys(payload));
    if (seen.has(signature)) continue;
    seen.add(signature);

    const { data, error } = await supabase
      .from('leads')
      .insert([payload])
      .select()
      .single();

    if (!error) return data;

    lastError = error;

    if (isMissingColumnError(error)) {
      const missingColumn = columnFromMissingError(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        const retryPayload = { ...payload };
        delete retryPayload[missingColumn];
        attempts.push(stripUndefined(retryPayload));
      }
      continue;
    }
  }

  throw lastError || new Error('Failed to submit lead');
};
