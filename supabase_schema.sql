-- ============================================================
-- ELBNA STORE - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    price       INTEGER NOT NULL,
    image_url   TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for storefront)
CREATE POLICY "Public can read products"
    ON products FOR SELECT
    USING (true);

-- Allow service_role full access (for admin API routes)
CREATE POLICY "Service role full access"
    ON products FOR ALL
    USING (auth.role() = 'service_role');

-- Index for fast filtering by type
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
