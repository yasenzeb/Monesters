import { setCorsHeaders, requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { title, message, type } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'title و message مطلوبان' });
    }

    // type 'order' مسموح بدون مصادقة
    if (type === 'admin' && !requireAdmin(req)) {
      return res.status(401).json({ success: false, error: 'غير مصرح' });
    }

    const pUser = process.env.PUSHOVER_USER;
    const pToken = process.env.PUSHOVER_TOKEN;

    console.log('[API /notify] Pushover credentials:', {
      user: pUser ? '✓ موجود' : '✗ غير موجود',
      token: pToken ? '✓ موجود' : '✗ غير موجود',
    });

    if (!pUser || !pToken) {
      console.warn('[API /notify] Pushover not configured - returning success silently');
      return res.status(200).json({ success: true, sent: false, message: 'Pushover not configured' });
    }

    const fd = new URLSearchParams();
    fd.append('token', pToken);
    fd.append('user', pUser);
    fd.append('title', title.substring(0, 250));
    fd.append('message', message.substring(0, 1024));
    fd.append('priority', '1');
    fd.append('sound', 'cashregister');

    console.log('[API /notify] Sending to Pushover API...');

    const resp = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: fd
    });

    const result = await resp.json();
    console.log('[API /notify] Pushover response:', result);

    if (!resp.ok) {
      console.error('[API /notify] Pushover error:', result);
      return res.status(200).json({ success: true, sent: false, error: result });
    }

    return res.status(200).json({ success: true, sent: true });

  } catch (err) {
    console.error('[API /notify] Error:', err);
    return res.status(500).json({ success: false, error: 'فشل إرسال الإشعار' });
  }
}