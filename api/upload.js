export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { data: base64Data, fileName } = req.body;

    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No image data provided.' });
    }

    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey     = process.env.CLOUDINARY_API_KEY;
    const apiSecret  = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ success: false, error: 'Cloudinary env vars not configured.' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder    = 'elbna-store';

    const { createHash } = await import('crypto');
    const sig = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');

    const formData = new URLSearchParams();
    formData.append('file', base64Data);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('signature', sig);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    const cloudinaryData = await cloudinaryRes.json();

    if (!cloudinaryRes.ok || cloudinaryData.error) {
      throw new Error(cloudinaryData.error?.message || 'Cloudinary upload failed');
    }

    return res.status(200).json({
      success: true,
      url: cloudinaryData.secure_url,
      public_id: cloudinaryData.public_id
    });
  } catch (err) {
    console.error('[API /upload]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
