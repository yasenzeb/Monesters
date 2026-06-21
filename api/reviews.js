// api/reviews.js — إدارة آراء العملاء
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
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, name, text, rating, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, reviews: data || [] });
    }

    if (req.method === 'POST') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح.' });
      }

      const { name, text, rating } = req.body || {};

      if (!name || !text || !rating) {
        return res.status(400).json({ success: false, error: 'name, text, و rating مطلوبة.' });
      }

      const parsedRating = parseInt(rating);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ success: false, error: 'التقييم يجب أن يكون بين 1 و 5.' });
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert([{
          name:   String(name).trim().substring(0, 100),
          text:   String(text).trim().substring(0, 1000),
          rating: parsedRating
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, review: data });
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req)) {
        return res.status(401).json({ success: false, error: 'غير مصرح.' });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ success: false, error: 'id مطلوب في query string.' });
      }

      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الرأي.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /reviews]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}