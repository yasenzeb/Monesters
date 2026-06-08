import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (req.method === 'GET') {
      const { type } = req.query;
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;

      const products = (data || []).map(p => ({
        ...p,
        discount_type:  p.discount_type  || 'none',
        discount_value: p.discount_value || 0
      }));

      return res.status(200).json({ success: true, products });
    }

    if (req.method === 'POST') {
      const { name, type, price, image_url, discount_type, discount_value } = req.body;

      if (!name || !type || !price) {
        return res.status(400).json({ success: false, error: 'name, type, and price are required.' });
      }

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name,
          type,
          price:          parseInt(price),
          image_url:      image_url     || null,
          discount_type:  discount_type || 'none',
          discount_value: discount_value || 0
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, product: data });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /products]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
