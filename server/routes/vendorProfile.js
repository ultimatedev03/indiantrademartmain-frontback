import express from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { normalizeEmail } from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=300&q=80';
const FALLBACK_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80';
const ALLOWED_UPLOAD_BUCKETS = new Set(['avatars', 'product-images', 'product-media']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const isValidId = (v) => typeof v === 'string' && v.trim().length > 0;

const parseDataUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const match = raw.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) return null;
    return { mime: match[1], base64: match[2] };
  }
  return { mime: null, base64: raw };
};

const sanitizeFilename = (name) =>
  String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 120) || 'upload';

const buildUploadPath = ({ vendorId, originalName, contentType }) => {
  const safeName = sanitizeFilename(originalName || '');
  const extFromMime = MIME_EXT[contentType] || '';
  const hasExt = safeName.includes('.');
  const base = hasExt ? safeName.replace(/\.[^/.]+$/, '') : safeName;
  const ext = hasExt ? safeName.split('.').pop() : (extFromMime || 'bin');
  const fileName = `${base || 'upload'}.${ext}`;
  return `${vendorId}/${Date.now()}-${randomUUID()}-${fileName}`;
};

const VENDOR_UPDATE_BLOCK = new Set([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'role',
  'aud',
  'app_metadata',
  'user_metadata',
  'confirmed_at',
  'email_confirmed_at',
  'last_sign_in_at',
  'phone_confirmed_at',
  'identities',
  'factors',
  'is_anonymous',
]);

const sanitizeVendorUpdates = (updates = {}) => {
  const cleaned = {};
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (VENDOR_UPDATE_BLOCK.has(key)) return;
    if (value === undefined) return;
    cleaned[key] = value;
  });
  return cleaned;
};

async function resolveVendorForUser(user) {
  const userId = user?.id || null;
  const email = normalizeEmail(user?.email || '');

  let vendor = null;
  if (userId) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    vendor = data || null;
  }

  if (!vendor && email) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    vendor = data || null;
  }

  if (vendor && userId && vendor.user_id !== userId) {
    await supabase
      .from('vendors')
      .update({ user_id: userId })
      .eq('id', vendor.id);
    vendor.user_id = userId;
  }

  return vendor;
}

async function resolveBuyerId(userId) {
  if (!userId) return null;
  const { data: buyer } = await supabase
    .from('buyers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return buyer?.id || null;
}

// ✅ Current vendor profile (auth-required)
router.get('/me', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });
    return res.json({ success: true, vendor });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ✅ Update vendor profile (auth-required, bypasses RLS)
router.put('/me', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const payload = sanitizeVendorUpdates(req.body || {});
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('vendors')
      .update(payload)
      .eq('id', vendor.id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, vendor: data || { ...vendor, ...payload } });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ✅ Upload image/media to Supabase Storage (auth-required, bypasses RLS)
router.post('/me/upload', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const bucket = String(req.body?.bucket || 'avatars').trim() || 'avatars';
    if (!ALLOWED_UPLOAD_BUCKETS.has(bucket)) {
      return res.status(400).json({ success: false, error: 'Invalid upload bucket' });
    }

    const dataUrl = String(req.body?.data_url || req.body?.dataUrl || '').trim();
    const originalName = String(req.body?.file_name || req.body?.fileName || '').trim();
    const explicitType = String(req.body?.content_type || req.body?.contentType || '').trim();

    if (!dataUrl) {
      return res.status(400).json({ success: false, error: 'data_url is required' });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed?.base64) {
      return res.status(400).json({ success: false, error: 'Invalid base64 payload' });
    }

    const contentType = explicitType || parsed.mime || 'application/octet-stream';
    const allowVideo = bucket === 'product-media';
    const isAllowed =
      contentType.startsWith('image/') ||
      (allowVideo && contentType.startsWith('video/'));

    if (!isAllowed) {
      return res.status(400).json({ success: false, error: 'Unsupported file type' });
    }

    const buffer = Buffer.from(parsed.base64, 'base64');
    if (!buffer?.length) {
      return res.status(400).json({ success: false, error: 'Empty upload payload' });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ success: false, error: 'File too large (max 10MB)' });
    }

    const objectPath = buildUploadPath({
      vendorId: vendor.id,
      originalName,
      contentType,
    });

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ success: false, error: uploadError.message || 'Upload failed' });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return res.json({
      success: true,
      bucket,
      path: objectPath,
      publicUrl: data?.publicUrl || null,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ✅ Submit KYC for verification (auth-required)
router.post('/me/kyc/submit', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const { data, error } = await supabase
      .from('vendors')
      .update({ kyc_status: 'SUBMITTED', updated_at: new Date().toISOString() })
      .eq('id', vendor.id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, vendor: data || { ...vendor, kyc_status: 'SUBMITTED' } });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ✅ Vendor documents (auth-required)
router.get('/me/documents', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    let query = supabase
      .from('vendor_documents')
      .select('*')
      .eq('vendor_id', vendor.id);

    if (req.query?.type) query = query.eq('document_type', String(req.query.type));
    if (req.query?.status) query = query.eq('verification_status', String(req.query.status));

    const { data, error } = await query.order('uploaded_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, documents: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/me/documents/:docId', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const { docId } = req.params;
    if (!isValidId(docId)) {
      return res.status(400).json({ success: false, error: 'Invalid document id' });
    }

    const { data, error } = await supabase
      .from('vendor_documents')
      .select('*')
      .eq('id', docId)
      .eq('vendor_id', vendor.id)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Document not found' });
    return res.json({ success: true, document: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/me/documents', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const document_type = String(req.body?.document_type || '').trim();
    const document_url = String(req.body?.document_url || '').trim();
    const original_name = String(req.body?.original_name || '').trim() || null;

    if (!document_type || !document_url) {
      return res.status(400).json({ success: false, error: 'document_type and document_url are required' });
    }

    const { data, error } = await supabase
      .from('vendor_documents')
      .insert([{
        vendor_id: vendor.id,
        document_type,
        document_url,
        original_name,
        uploaded_at: new Date().toISOString(),
        verification_status: 'PENDING',
      }])
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true, document: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/me/documents/:docId', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const { docId } = req.params;
    if (!isValidId(docId)) {
      return res.status(400).json({ success: false, error: 'Invalid document id' });
    }

    const { error } = await supabase
      .from('vendor_documents')
      .delete()
      .eq('id', docId)
      .eq('vendor_id', vendor.id);

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/me/documents', requireAuth({ roles: ['VENDOR'] }), async (req, res) => {
  try {
    const vendor = await resolveVendorForUser(req.user);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor profile not found' });

    const docType = String(req.query?.type || '').trim();
    if (!docType) {
      return res.status(400).json({ success: false, error: 'type query param is required' });
    }

    const { error } = await supabase
      .from('vendor_documents')
      .delete()
      .eq('vendor_id', vendor.id)
      .eq('document_type', docType);

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:vendorId', async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' });

    return res.json({ success: true, vendor });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:vendorId/products', async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, price, price_unit, images, category_other, micro_category_id, sub_category_id, head_category_id')
      .eq('vendor_id', vendorId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (pErr) return res.status(500).json({ success: false, error: pErr.message });

    const microIds = Array.from(new Set((products || []).map((p) => p.micro_category_id).filter(Boolean)));
    const subIds = Array.from(new Set((products || []).map((p) => p.sub_category_id).filter(Boolean)));
    const headIds = Array.from(new Set((products || []).map((p) => p.head_category_id).filter(Boolean)));

    const [microRes, subRes, headRes] = await Promise.all([
      microIds.length
        ? supabase
            .from('micro_categories')
            .select('id, name, sub_categories(id, name, head_categories(id, name))')
            .in('id', microIds)
        : Promise.resolve({ data: [] }),
      subIds.length
        ? supabase
            .from('sub_categories')
            .select('id, name, head_categories(id, name)')
            .in('id', subIds)
        : Promise.resolve({ data: [] }),
      headIds.length
        ? supabase.from('head_categories').select('id, name').in('id', headIds)
        : Promise.resolve({ data: [] }),
    ]);

    const microLookup = {};
    (microRes?.data || []).forEach((m) => {
      microLookup[m.id] = {
        microName: m.name,
        subId: m.sub_categories?.id || null,
        subName: m.sub_categories?.name || null,
        headId: m.sub_categories?.head_categories?.id || null,
        headName: m.sub_categories?.head_categories?.name || null,
      };
    });

    const subLookup = {};
    (subRes?.data || []).forEach((s) => {
      subLookup[s.id] = {
        subName: s.name,
        headId: s.head_categories?.id || null,
        headName: s.head_categories?.name || null,
      };
    });

    const headLookup = {};
    (headRes?.data || []).forEach((h) => {
      headLookup[h.id] = h.name;
    });

    const mappedProducts = (products || []).map((p) => {
      const microInfo = microLookup[p.micro_category_id] || {};
      const subInfo = subLookup[p.sub_category_id] || {};
      const headName =
        microInfo.headName ||
        subInfo.headName ||
        headLookup[p.head_category_id] ||
        'Other Category';
      const subName =
        microInfo.subName ||
        subInfo.subName ||
        p.category_other ||
        'Other Subcategory';

      const image =
        (p.images && Array.isArray(p.images) && p.images[0]) ||
        (p.images && typeof p.images === 'string' ? p.images : FALLBACK_IMAGE);

      return {
        id: p.id,
        name: p.name,
        price: `₹${p.price}${p.price_unit ? ' / ' + p.price_unit : ''}`,
        category: p.category_other || microInfo.microName || subName || 'General',
        head_category_name: headName,
        sub_category_name: subName,
        micro_category_name: microInfo.microName || null,
        image,
      };
    });

    return res.json({ success: true, products: mappedProducts });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:vendorId/services', async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    let mappedServices = [];
    try {
      const { data: services, error } = await supabase
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId);

      if (error) throw error;

      if (services?.length) {
        mappedServices = services.map((service) => ({
          id: service.id,
          name: service.name || service.service_name || service.title || 'Service',
          category: service.category || service.service_type || 'Service',
          description:
            service.description ||
            service.details ||
            service.short_description ||
            'Service details coming soon.',
          price: service.price
            ? `₹${service.price}${service.price_unit ? ' / ' + service.price_unit : ''}`
            : service.rate
              ? `₹${service.rate}`
              : 'Price on request',
          image:
            service.image ||
            service.cover_image ||
            (Array.isArray(service.images) ? service.images[0] : null) ||
            FALLBACK_SERVICE_IMAGE,
        }));
      }
    } catch {
      mappedServices = [];
    }

    return res.json({ success: true, services: mappedServices });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:vendorId/service-categories', async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const { data: prefs, error } = await supabase
      .from('vendor_preferences')
      .select('preferred_micro_categories')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });

    const ids = prefs?.preferred_micro_categories || [];
    if (!ids?.length) return res.json({ success: true, categories: [] });

    const { data: headCats, error: headErr } = await supabase
      .from('head_categories')
      .select('id, name')
      .in('id', ids);

    if (headErr) return res.status(500).json({ success: false, error: headErr.message });

    const mapped = (headCats || []).map((h) => ({ id: h.id, name: h.name }));
    return res.json({ success: true, categories: mapped });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:vendorId/favorite', requireAuth({ roles: ['BUYER'] }), async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const buyerId = await resolveBuyerId(req.user.id);
    if (!buyerId) {
      return res.status(404).json({ success: false, error: 'Buyer profile not found' });
    }

    const { data: favRow, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, isFavorite: !!favRow?.id });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:vendorId/favorite', requireAuth({ roles: ['BUYER'] }), async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const buyerId = await resolveBuyerId(req.user.id);
    if (!buyerId) {
      return res.status(404).json({ success: false, error: 'Buyer profile not found' });
    }

    const { error } = await supabase
      .from('favorites')
      .insert([{ buyer_id: buyerId, vendor_id: vendorId }]);

    if (error && String(error.message || '').toLowerCase().includes('duplicate')) {
      return res.json({ success: true, isFavorite: true });
    }

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, isFavorite: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:vendorId/favorite', requireAuth({ roles: ['BUYER'] }), async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const buyerId = await resolveBuyerId(req.user.id);
    if (!buyerId) {
      return res.status(404).json({ success: false, error: 'Buyer profile not found' });
    }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .match({ buyer_id: buyerId, vendor_id: vendorId });

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, isFavorite: false });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:vendorId/leads', requireAuth({ roles: ['BUYER'] }), async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!isValidId(vendorId)) {
      return res.status(400).json({ success: false, error: 'Invalid vendor id' });
    }

    const buyerId = await resolveBuyerId(req.user.id);
    if (!buyerId) {
      return res.status(404).json({ success: false, error: 'Buyer profile not found' });
    }

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('buyer_id', buyerId);

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, leads: leads || [] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
