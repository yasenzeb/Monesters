import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    /* ── GET /api/categories ── */
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, categories: data || [] });
    }

    /* ── POST /api/categories ── */
    if (req.method === 'POST') {
      const { name, slug } = req.body || {};

      if (!name || !slug) {
        return res.status(400).json({ success: false, error: 'name و slug مطلوبان.' });
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

      const { data, error } = await supabase
        .from('categories')
        .insert([{ name: name.trim(), slug: cleanSlug }])
        .select()
        .single();

      if (error) {
        // Unique violation on slug
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'هذا المعرف (slug) موجود بالفعل.' });
        }
        throw error;
      }

      return res.status(201).json({ success: true, category: data });
    }

    /* ── DELETE /api/categories?slug=xxx ── */
    if (req.method === 'DELETE') {
      const { slug } = req.query;

      if (!slug) {
        return res.status(400).json({ success: false, error: 'slug مطلوب في query string.' });
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('slug', slug);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الفئة.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /categories]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
