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
    /* ── GET /api/products — عام (بدون مصادقة) ── */
    if (req.method === 'GET') {
      const { type } = req.query;
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (type && type !== 'all') {
        // تحقق من أن type نص آمن فقط
        const safeType = String(type).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
        if (safeType) query = query.eq('type', safeType);
      }

      const { data, error } = await query;
      if (error) throw error;

      const products = (data || []).map(p => ({
        ...p,
        discount_type:    p.discount_type  || 'none',
        discount_value:   p.discount_value || 0,
        sizes:            Array.isArray(p.sizes) && p.sizes.length ? p.sizes : [38,39,40,41,42,43,44,45],
        colors:           Array.isArray(p.colors) ? p.colors : [],
        gallery:          Array.isArray(p.gallery) ? p.gallery : [],
        main_image_index: p.main_image_index || 0
      }));

      return res.status(200).json({ success: true, products });
    }

    /* ── POST /api/products — يتطلب مصادقة Admin ── */
    if (req.method === 'POST') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح — يجب تسجيل دخول الأدمن' });
      }

      const { name, type, price, image_url, discount_type, discount_value, sizes, colors, gallery, main_image_index } = req.body || {};

      if (!name || !type || !price) {
        return res.status(400).json({ success: false, error: 'name, type, and price are required.' });
      }

      const parsedPrice = parseInt(price);
      if (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000) {
        return res.status(400).json({ success: false, error: 'السعر غير صحيح' });
      }

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name:             String(name).substring(0, 200),
          type:             String(type).substring(0, 50),
          price:            parsedPrice,
          image_url:        image_url     || null,
          discount_type:    discount_type || 'none',
          discount_value:   discount_value || 0,
          sizes:            Array.isArray(sizes) && sizes.length ? sizes : [38,39,40,41,42,43,44,45],
          colors:           Array.isArray(colors) ? colors : [],
          gallery:          Array.isArray(gallery) ? gallery : [],
          main_image_index: main_image_index || 0
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, product: data });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /products]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}