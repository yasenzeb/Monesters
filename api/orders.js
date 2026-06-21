// api/orders.js — عمليات الأدمن على الطلبات (GET / DELETE / PUT)
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, requireAdmin, safeError } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // جميع العمليات تستلزم صلاحيات الأدمن
  if (!requireAdmin(req)) {
    return res.status(401).json({ success: false, error: 'غير مصرح.' });
  }

  try {
    /* ── GET /api/orders ── */
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, orders: data || [] });
    }

    /* ── DELETE /api/orders?id=xxx ── */
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, error: 'id مطلوب.' });
      }

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الطلب.' });
    }

    /* ── PUT /api/orders?id=xxx — تحديث حالة الطلب ── */
    if (req.method === 'PUT') {
      const { id }     = req.query;
      const { status } = req.body || {};
      const allowed    = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

      if (!id || !status || !allowed.includes(status)) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة.' });
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, order: data });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /orders]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
