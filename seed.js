import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ══════════════════════════════════════════════════════
//  ALL PRODUCTS — 143 items across 4 categories
//  Call POST /api/seed once to insert all into Supabase
// ══════════════════════════════════════════════════════
const PRODUCTS = [
  // ── ISO PROTEIN ──
  { name: 'ايزو اذجرت ٢ كيلو ٢٧٠ جرام ٧٠ سيرف',        type: 'protein', price: 4800 },
  { name: 'ايزو مصل تيك ٢ كيلو و٣٠٠ جرام ٧٣ سيرف',      type: 'protein', price: 5300 },
  { name: 'ايزو نيتركس ٢ كيلو و٣٠٠ جرام ٧٠ سيرف',       type: 'protein', price: 5000 },
  { name: 'ايزو ياڤا لاب ٢ كيلو ٦٠ سيرف',               type: 'protein', price: 4750 },
  { name: 'ايزو نوفيجين فارما كيلو ٣٠ سيرف',            type: 'protein', price: 1800 },
  { name: 'ايزو ١٠٠ كيلوين وربع ٧٥ سيرف',               type: 'protein', price: 5300 },
  { name: 'ايزو npp كيلو ٣٠ سيرف',                       type: 'protein', price: 1750 },
  { name: 'بيف ريدركس ايزو ٢ كيلو ٦٠ سيرف',             type: 'protein', price: 3200 },
  { name: 'ايزو مرفلوس الاسباني ٨٠ جرعة',               type: 'protein', price: 4800 },
  { name: 'ايزو نوفجين ٢ كيلو ٦٠ سيرف',                 type: 'protein', price: 3500 },
  // ── WHEY PROTEIN ──
  { name: 'واي يافا لاب ٢ كيلو ٦٠ سيرف',                type: 'protein', price: 3900 },
  { name: 'واي نيتركس ٢ كيلو و٢٣٠٠ جرام ٦٤ سيرف',      type: 'protein', price: 4100 },
  { name: 'واي جولد استندر ٢ كيلو وربع ٧٢ جرعة',        type: 'protein', price: 5800 },
  { name: 'واي فيرتكس كيلو ٣٠ سيرف',                    type: 'protein', price: 1800 },
  { name: 'واي اذجرت ٢ كيلو و٢٧٠ جرام ٦٥ سيرف',        type: 'protein', price: 3800 },
  { name: 'بروتين بريميم كيلو ٣٠ سيرف',                 type: 'protein', price: 2200 },
  { name: 'واي بروتين كيك كويج كيلو ٣٠ سيرف',           type: 'protein', price: 2100 },
  { name: 'واي بروتين كامبرو كيلو',                      type: 'protein', price: 1500 },
  { name: 'واي بروتين ريدركس ٢ كيلو ٦٠ جرعة',           type: 'protein', price: 3150 },
  { name: 'نيتروتك كيلو ٨٠٠ جرام ٤٥ سيرف',             type: 'protein', price: 3700 },
  { name: 'نيروتك واي جولد ٢ كيلو وربع ٧٢ سيرف',        type: 'protein', price: 4200 },
  { name: 'واي بروتين ميجا هيلث كيلو ٣٠ سيرف',          type: 'protein', price: 1500 },
  { name: 'واي بروتين ريدركس كيلو ٣٠ سيرف',             type: 'protein', price: 1800 },
  { name: 'واي بروتين نوفجين كيلو ٣٠ سيرف',             type: 'protein', price: 1650 },
  // ── MASS GAINER ──
  { name: 'ماس اذجرت اكس تريم ٤ كيلو و٥٠٠ جرام ٣٠ سيرف', type: 'mass', price: 3500 },
  { name: 'ماس جينر التميد ٤ كيلو ٢٨ سيرف',             type: 'mass', price: 800  },
  { name: 'ماس مرفلوس الاسباني ٣٠ جرعة بدون سكر',       type: 'mass', price: 2500 },
  { name: 'ماس جينر اكس تريم شركة دراجون ٦٠ سيرف',      type: 'mass', price: 1300 },
  { name: 'ماس جينر كامبرو ٧ كيلو ٢٣ سيرف',             type: 'mass', price: 2650 },
  { name: 'ماس جينر شركة سكيلتون ٣ كيلو ٧ سيرف',        type: 'mass', price: 1800 },
  { name: 'ماس npp ٥ كيلو و٤٠٠ جرام',                   type: 'mass', price: 2300 },
  { name: 'فيوركس ماس ٦ كيلو',                           type: 'mass', price: 1500 },
  { name: 'فيوركس ماس ٣ كيلو',                           type: 'mass', price: 900  },
  { name: 'ماس كامبرو ٣ كيلو ٢٠ سيرف',                  type: 'mass', price: 1250 },
  { name: 'كربوتين ٤ كيلو ماس جينر',                    type: 'mass', price: 1000 },
  { name: 'فيوجين ماس ٥ كيلو ونصف',                     type: 'mass', price: 3600 },
  { name: 'ماس هالك ٢ كيلو ٥٠ سيرف',                    type: 'mass', price: 750  },
  { name: 'ماس جينر نوفجين ٥ كيلو و٤٠٠ جرام',           type: 'mass', price: 2600 },
  { name: 'ماس يوبي ٥ كيلو',                             type: 'mass', price: 1350 },
  { name: 'ماس برو ٥ كيلو هارد كور',                    type: 'mass', price: 3500 },
  // ── CREATINE ──
  { name: 'كرياتين نتركس ٣٠٠ جرام ٦٠ جرعة',             type: 'creatine', price: 1000 },
  { name: 'كرياتين بلاتنيوم ٤٠٠ جرام ٨٠ جرعة',          type: 'creatine', price: 2300 },
  { name: 'كرياتين دوريان ٣٠٠ جرام ٦٠ جرعة',            type: 'creatine', price: 1200 },
  { name: 'كرياتين الشارك ٣٠٠ جرام ١٠٠ جرعة',           type: 'creatine', price: 1000 },
  { name: 'كرياتين مارفلوس ٣٠٠ جرام ٦٠ جرعة',           type: 'creatine', price: 950  },
  { name: 'كرياتين انابولك دراجون ١٠٠ جرعة',            type: 'creatine', price: 650  },
  { name: 'كرياتين انابولك دراجون ٢٠٠ جرعة',            type: 'creatine', price: 850  },
  { name: 'كرياتين انابولك دراجون ٤٠ جرعة',             type: 'creatine', price: 300  },
  { name: 'كرياتين انابولك دراجون ٥٠ جرعة',             type: 'creatine', price: 400  },
  { name: 'كرياتين بيورجانك الماني ٣٠ جرعة',            type: 'creatine', price: 600  },
  { name: 'كرياتين بيورجانك الماني ٦٠ جرعة',            type: 'creatine', price: 900  },
  { name: 'كرياتين بيورجانك الماني نص كيلو ١٠٠ جرعة',   type: 'creatine', price: 1350 },
  { name: 'كرياتين بيورجانك ٦٠ جرعة',                   type: 'creatine', price: 650  },
  { name: 'كرياتين بيورجانك نص كيلو ١٠٠ جرعة',          type: 'creatine', price: 850  },
  { name: 'كرياتين بيوجانيك العادي ١٥٠ جرام ٣٠ جرعة',   type: 'creatine', price: 450  },
  { name: 'كرياتين بيور اسباني ٣٠٠ جرام ١٠٠ جرعة',      type: 'creatine', price: 1100 },
  { name: 'كرياتين ريد ريكس ٣٠٠ جرام ٦٠ جرعة',          type: 'creatine', price: 950  },
  { name: 'كرياتين ترياكتور ٤٠ جرعة',                   type: 'creatine', price: 400  },
  { name: 'كرياتين ترياكتور ٨٠ جرعة',                   type: 'creatine', price: 650  },
  { name: 'كرياتين ترياكتور ١٦٠ جرعة',                  type: 'creatine', price: 900  },
  { name: 'كرياتين فيرتكس الماني ٤٠٠ جرام ٨٠ جرعة',     type: 'creatine', price: 1000 },
  { name: 'كرياتين سبريور ٣٠٠ جرام ٥٠ جرعة بطعم مستورد', type: 'creatine', price: 1000 },
  { name: 'كرياتين نوفجين ٣٠٠ جرام ٦٠ جرعة',            type: 'creatine', price: 800  },
  { name: 'كرياتين كريا روك ٣٠٠ جرام ٦٠ جرعة',          type: 'creatine', price: 800  },
  { name: 'كرياتين كريا روك ٢٠٠ جرام ٤٠ جرعة',          type: 'creatine', price: 550  },
  { name: 'كرياتين ON ٣٠٠ جرام ٦٠ جرعة',                type: 'creatine', price: 2000 },
  { name: 'كريا ريد ترياكتور ٥٤٠ جرام ١٨٠ جرعة',        type: 'creatine', price: 1650 },
  { name: 'كرياتين رول وان ٣٩٠ جرام ٧٥ جرعة',           type: 'creatine', price: 1350 },
  { name: 'كرياتين فامبير ٤٠٠ جرام ٨٠ جرعة',            type: 'creatine', price: 800  },
  { name: 'كرياتين فامبير ١٥٠ جرام ٣٠ جرعة',            type: 'creatine', price: 450  },
  { name: 'كرياتين سكيلتون ١٦٥ جرعة',                   type: 'creatine', price: 1000 },
  { name: 'كرياتين مصل سيكريت ٦٠٠ جرام ٢٠٠ جرعة',       type: 'creatine', price: 1050 },
  { name: 'كرياتين مصل سيكريت نص كيلو ١٠٠ جرعة',        type: 'creatine', price: 850  },
  { name: 'كرياتين مصل سيكريت ٣٠٠ جرام ٦٠ جرعة',        type: 'creatine', price: 650  },
  { name: 'كرياتين مصل سيكريت ٢٠٠ جرام ٦٦ جرعة',        type: 'creatine', price: 450  },
  { name: 'كرياتين انابولك مستورد كيفن ليفرون ٣٠٠ جرام ٦٠ جرعة', type: 'creatine', price: 1100 },
  { name: 'كرياتين اول ماكس ٤٠٠ جرام ٨٠ جرعة',          type: 'creatine', price: 1500 },
  { name: 'كرياتين ياڤا لاب ٣٠٠ جرام ٦٠ جرعة',          type: 'creatine', price: 1200 },
  { name: 'كرياتين فيرتكس ١٥٠ جرام ٣٠ جرعة',            type: 'creatine', price: 450  },
  { name: 'كرياتين فيرتكس ٣٠٠ جرام ٦٠ جرعة',            type: 'creatine', price: 750  },
  { name: 'كريا باور ١٥٠ جرام ٣٠ جرعة',                 type: 'creatine', price: 600  },
  { name: 'كريا باور ٢٥٠ جرام ٥٠ جرعة',                 type: 'creatine', price: 800  },
  { name: 'كريا باور ٤٠٠ جرام ٨٠ جرعة',                 type: 'creatine', price: 1250 },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Security: require a secret header to avoid public abuse
  const secret = req.headers['x-seed-secret'];
  if (secret !== process.env.SEED_SECRET && process.env.SEED_SECRET) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    // Just return the products list without inserting
    return res.status(200).json({ success: true, count: PRODUCTS.length, products: PRODUCTS });
  }

  if (req.method === 'POST') {
    try {
      // Insert in chunks of 20 to avoid timeouts
      const CHUNK = 20;
      let inserted = 0;
      for (let i = 0; i < PRODUCTS.length; i += CHUNK) {
        const chunk = PRODUCTS.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('products')
          .upsert(chunk, { onConflict: 'name' }); // skip duplicates by name
        if (error) throw error;
        inserted += chunk.length;
      }
      return res.status(200).json({ success: true, inserted, message: `تم إضافة ${inserted} منتج بنجاح` });
    } catch (err) {
      console.error('[API /seed]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
