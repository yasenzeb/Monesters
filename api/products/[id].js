import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, requireAdmin, safeError } from '../_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Product ID is required.' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Product not found.' });

      const product = {
        ...data,
        discount_type:    data.discount_type  || 'none',
        discount_value:   data.discount_value || 0,
        sizes:            Array.isArray(data.sizes) && data.sizes.length ? data.sizes : [38,39,40,41,42,43,44,45],
        colors:           Array.isArray(data.colors) ? data.colors : [],
        gallery:          Array.isArray(data.gallery) ? data.gallery : [],
        main_image_index: data.main_image_index || 0
      };

      return res.status(200).json({ success: true, product });
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح.' });
      }

      const { name, type, price, image_url, discount_type, discount_value, sizes, colors, gallery, main_image_index } = req.body || {};
      const updates = {};

      if (name              !== undefined) updates.name              = name;
      if (type              !== undefined) updates.type              = type;
      if (price             !== undefined) updates.price             = parseInt(price);
      if (image_url         !== undefined) updates.image_url         = image_url;
      if (discount_type     !== undefined) updates.discount_type     = discount_type;
      if (discount_value    !== undefined) {
        updates.discount_value = discount_type === 'none' ? 0 : parseFloat(discount_value) || 0;
      }
      if (sizes             !== undefined) updates.sizes             = Array.isArray(sizes) && sizes.length ? sizes : [38,39,40,41,42,43,44,45];
      if (colors            !== undefined) updates.colors            = Array.isArray(colors) ? colors : [];
      if (gallery           !== undefined) updates.gallery           = Array.isArray(gallery) ? gallery : [];
      if (main_image_index  !== undefined) updates.main_image_index  = parseInt(main_image_index) || 0;

      if (updates.discount_type === 'none') {
        updates.discount_value = 0;
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, product: data });
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح.' });
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Product deleted.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error(`[API /products/${id}]`, err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
