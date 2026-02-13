import express from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { normalizeRole } from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
const EMPLOYEE_UPLOAD_ROLES = new Set(['DATA_ENTRY', 'ADMIN', 'SUPERADMIN', 'HR', 'SUPPORT']);
const CATEGORY_IMAGE_BUCKET = 'avatars';
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
};

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

const safeSlug = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'category';

const sanitizeFilename = (name = '') =>
  String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 120) || 'upload';

const normalizeLevel = (value = '') => {
  const level = String(value || '').trim().toLowerCase();
  if (['head', 'sub', 'micro'].includes(level)) return level;
  return 'head';
};

const buildCategoryImagePath = ({ level, slug, originalName, contentType }) => {
  const safeName = sanitizeFilename(originalName || '');
  const extFromMime = MIME_EXT[contentType] || 'png';
  const hasExt = safeName.includes('.');
  const base = hasExt ? safeName.replace(/\.[^/.]+$/, '') : safeName;
  const ext = hasExt ? safeName.split('.').pop() : extFromMime;
  return `category-images/${normalizeLevel(level)}/${safeSlug(slug)}/${Date.now()}-${randomUUID()}-${base || 'category'}.${ext}`;
};

async function resolveEmployee(authUser) {
  const email = String(authUser?.email || '').trim().toLowerCase();
  let employee = null;

  const { data: byId } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();
  if (byId) employee = byId;

  if (!employee && email) {
    const { data: byEmail } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (byEmail) employee = byEmail;
  }

  if (employee && (!employee.user_id || employee.user_id !== authUser.id)) {
    await supabase
      .from('employees')
      .update({ user_id: authUser.id })
      .eq('id', employee.id);
    employee.user_id = authUser.id;
  }

  return employee;
}

router.get('/me', requireAuth(), async (req, res) => {
  try {
    const authUser = req.user;
    const employee = await resolveEmployee(authUser);

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee profile not found' });
    }

    return res.json({
      success: true,
      employee: {
        ...employee,
        user_id: authUser.id,
        role: normalizeRole(employee.role || 'UNKNOWN'),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Failed to resolve employee profile' });
  }
});

router.post('/upload-category-image', requireAuth(), async (req, res) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee profile not found' });
    }

    const role = normalizeRole(employee.role || '');
    if (!EMPLOYEE_UPLOAD_ROLES.has(role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const dataUrl = String(req.body?.data_url || req.body?.dataUrl || '').trim();
    const fileName = String(req.body?.file_name || req.body?.fileName || '').trim();
    const explicitType = String(req.body?.content_type || req.body?.contentType || '').trim();
    const level = normalizeLevel(req.body?.level || 'head');
    const slug = String(req.body?.slug || '').trim();

    if (!dataUrl) {
      return res.status(400).json({ success: false, error: 'data_url is required' });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed?.base64) {
      return res.status(400).json({ success: false, error: 'Invalid base64 payload' });
    }

    const contentType = explicitType || parsed.mime || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Only image uploads are supported' });
    }

    const buffer = Buffer.from(parsed.base64, 'base64');
    if (!buffer?.length) {
      return res.status(400).json({ success: false, error: 'Empty upload payload' });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ success: false, error: 'File too large (max 10MB)' });
    }

    const objectPath = buildCategoryImagePath({
      level,
      slug,
      originalName: fileName,
      contentType,
    });

    const { error: uploadError } = await supabase.storage
      .from(CATEGORY_IMAGE_BUCKET)
      .upload(objectPath, buffer, {
        contentType,
        upsert: true,
      });
    if (uploadError) {
      return res.status(500).json({ success: false, error: uploadError.message || 'Upload failed' });
    }

    const { data } = supabase.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(objectPath);
    return res.json({
      success: true,
      publicUrl: data?.publicUrl || null,
      bucket: CATEGORY_IMAGE_BUCKET,
      path: objectPath,
      level,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Failed to upload image' });
  }
});

export default router;
