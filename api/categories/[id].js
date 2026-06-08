import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Category ID is required.' });
  }

  try {
    /* ── GET /api/categories/[id] ── */
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'الفئة غير موجودة.' });
      return res.status(200).json({ success: true, category: data });
    }

    /* ── PUT /api/categories/[id] ── */
    if (req.method === 'PUT') {
      const { name, slug } = req.body || {};
      const updates = {};

      if (name !== undefined) updates.name = name.trim();
      if (slug !== undefined) {
        updates.slug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, error: 'لا توجد بيانات للتحديث.' });
      }

      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'هذا المعرف (slug) موجود بالفعل.' });
        }
        throw error;
      }

      return res.status(200).json({ success: true, category: data });
    }

    /* ── DELETE /api/categories/[id] ── */
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الفئة.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error(`[API /categories/${id}]`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
