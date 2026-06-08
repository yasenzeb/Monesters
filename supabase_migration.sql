DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    price INTEGER NOT NULL,
    image_url TEXT,
    discount_type TEXT NOT NULL DEFAULT 'none',
    discount_value NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON products FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories (name, slug) VALUES
  ('كوتشيات', 'sneakers'),
  ('سليبرز', 'slippers'),
  ('أحذية رياضية', 'sports'),
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select_public" ON categories FOR SELECT USING (true);