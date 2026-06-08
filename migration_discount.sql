-- ══════════════════════════════════════════════
-- MIGRATION: Add discount fields to products
-- Run this once in Supabase SQL Editor
-- ══════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_type  TEXT    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;
