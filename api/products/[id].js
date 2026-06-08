import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

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
      return res.status(200).json({ success: true, product: data });
    }

    if (req.method === 'PUT') {
      const { name, type, price, image_url, discount_type, discount_value } = req.body || {};
      const updates = {};

      if (name          !== undefined) updates.name          = name;
      if (type          !== undefined) updates.type          = type;
      if (price         !== undefined) updates.price         = parseInt(price);
      if (image_url     !== undefined) updates.image_url     = image_url;
      if (discount_type !== undefined) updates.discount_type = discount_type;
      if (discount_value !== undefined) {
        updates.discount_value = discount_type === 'none' ? 0 : parseFloat(discount_value) || 0;
      }

      // If discount_type is 'none', always zero out the value
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
    return res.status(500).json({ success: false, error: err.message });
  }
}
