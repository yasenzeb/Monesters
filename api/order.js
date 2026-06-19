// api/order.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC = 'monsters-orders-x7k2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { name, phone, gov, address, notes, payment, items, subtotal, shipping, total } = req.body;

    if (!name || !phone || !gov || !address || !items?.length) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);

    // إدخال الأوردر في سوبابيز (البوت سيتحسس هذا السطر فوراً)
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        order_number:   orderNumber,
        customer_name:  name,
        phone,
        governorate:    gov,
        address,
        notes:          notes || '',
        payment_method: payment,
        items:          items,
        subtotal,
        shipping_cost:  shipping,
        total,
        status:         'pending',
        created_at:     new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, order: { order_number: orderNumber, ...order } });

  } catch (err) {
    console.error('[API /order]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}