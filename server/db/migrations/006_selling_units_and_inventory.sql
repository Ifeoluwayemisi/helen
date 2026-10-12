-- ====================================================================
-- Hellen Store POS & Inventory: Migration 006_selling_units_and_inventory.sql
-- Drinks Distribution, Selling Units, Conversion Factors & Inventory Foundations
-- ====================================================================

-- 1. Add selling units and pricing tier columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(32) NOT NULL DEFAULT 'bottle';
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0);

-- Pack configuration (e.g., 6-pack, 12-pack)
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_pack BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_unit_name VARCHAR(64) DEFAULT 'Pack';
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size INTEGER CHECK (pack_size IS NULL OR pack_size > 1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_retail_price NUMERIC(12,2) CHECK (pack_retail_price IS NULL OR pack_retail_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_wholesale_price NUMERIC(12,2) CHECK (pack_wholesale_price IS NULL OR pack_wholesale_price >= 0);

-- Carton / Crate configuration (e.g., Carton of 24, Carton of 36)
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_carton BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS carton_unit_name VARCHAR(64) DEFAULT 'Carton';
ALTER TABLE products ADD COLUMN IF NOT EXISTS carton_size INTEGER CHECK (carton_size IS NULL OR carton_size > 1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS carton_retail_price NUMERIC(12,2) CHECK (carton_retail_price IS NULL OR carton_retail_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS carton_wholesale_price NUMERIC(12,2) CHECK (carton_wholesale_price IS NULL OR carton_wholesale_price >= 0);

-- 2. Expand stock_movements type constraint to support OPENING_STOCK
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check 
  CHECK (type IN ('RECEIVED', 'SALE', 'ADJUSTMENT', 'DAMAGED', 'RETURN', 'OPENING_STOCK'));

-- 3. Enhance initial drink products with realistic distribution selling units
UPDATE products
SET 
  base_unit = 'bottle',
  selling_price = 350.00,
  wholesale_price = 300.00,
  has_pack = TRUE,
  pack_unit_name = 'Pack of 12',
  pack_size = 12,
  pack_retail_price = 4200.00,
  pack_wholesale_price = 3600.00,
  has_carton = TRUE,
  carton_unit_name = 'Carton of 24',
  carton_size = 24,
  carton_retail_price = 8200.00,
  carton_wholesale_price = 7000.00
WHERE id = 'prod_8'; -- Coca-Cola Original 50cl PET

UPDATE products
SET 
  base_unit = 'bottle',
  selling_price = 250.00,
  wholesale_price = 200.00,
  has_pack = TRUE,
  pack_unit_name = 'Pack of 12',
  pack_size = 12,
  pack_retail_price = 2800.00,
  pack_wholesale_price = 2300.00
WHERE id = 'prod_10'; -- Eva Water 75cl

UPDATE products
SET 
  base_unit = 'pack',
  selling_price = 2100.00,
  wholesale_price = 1850.00,
  has_carton = TRUE,
  carton_unit_name = 'Carton of 10',
  carton_size = 10,
  carton_retail_price = 20500.00,
  carton_wholesale_price = 18000.00
WHERE id = 'prod_9'; -- Chi Exotic Juice 1L

UPDATE products
SET 
  base_unit = 'bottle',
  selling_price = 2400.00,
  wholesale_price = 2100.00,
  has_pack = TRUE,
  pack_unit_name = 'Pack of 6',
  pack_size = 6,
  pack_retail_price = 14000.00,
  pack_wholesale_price = 12200.00
WHERE id = 'prod_18'; -- Hollandia Yoghurt 1L

UPDATE products
SET 
  base_unit = 'packet',
  wholesale_price = 4200.00,
  has_carton = TRUE,
  carton_unit_name = 'Carton of 40',
  carton_size = 40,
  carton_retail_price = 18500.00,
  carton_wholesale_price = 16800.00
WHERE id = 'prod_5'; -- Indomie Instant Noodles Super Pack
