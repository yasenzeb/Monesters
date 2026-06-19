// api/order-receipt.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { order_number, receipt_url } = req.body;

    if (!order_number || !receipt_url) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ receipt_url })
      .eq('order_number', order_number)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, order: data });

  } catch (err) {
    console.error('[API /order-receipt]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
