import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, requireAdmin, safeError } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    /* ── GET /api/categories — عام (بدون مصادقة) ── */
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, categories: data || [] });
    }

    /* ── POST /api/categories — يتطلب مصادقة Admin ── */
    if (req.method === 'POST') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح' });
      }

      const { name, slug } = req.body || {};

      if (!name || !slug) {
        return res.status(400).json({ success: false, error: 'name و slug مطلوبان.' });
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 100);
      const cleanName = String(name).trim().substring(0, 100);

      if (!cleanSlug) {
        return res.status(400).json({ success: false, error: 'slug يحتوي على أحرف غير صالحة.' });
      }

      const { data, error } = await supabase
        .from('categories')
        .insert([{ name: cleanName, slug: cleanSlug }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'هذا المعرف (slug) موجود بالفعل.' });
        }
        throw error;
      }

      return res.status(201).json({ success: true, category: data });
    }

    /* ── DELETE /api/categories?slug=xxx — يتطلب مصادقة Admin ── */
    if (req.method === 'DELETE') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح' });
      }

      const { slug } = req.query;

      if (!slug) {
        return res.status(400).json({ success: false, error: 'slug مطلوب في query string.' });
      }

      const safeSlug = String(slug).replace(/[^\w-]/g, '').substring(0, 100);
      if (!safeSlug) {
        return res.status(400).json({ success: false, error: 'slug غير صالح.' });
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('slug', safeSlug);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الفئة.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /categories]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
