-- ====================================================================
-- Hellen Store POS & Inventory: Migration 004_demo_seed.sql
-- DEMO DATA ONLY: Do not run in production with live customer data!
-- This file populates initial supermarket items, categories, and test staff.
-- ====================================================================

-- 1. Initial Default Staff (Demo Accounts)
INSERT INTO users (id, name, email, role, active, pin)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Hellen Olayode', 'hellen@hellenstore.com', 'ADMIN', TRUE, '1234'),
  ('a0000000-0000-0000-0000-000000000002', 'Blessing Adebayo', 'blessing@hellenstore.com', 'CASHIER', TRUE, '0000'),
  ('a0000000-0000-0000-0000-000000000003', 'Emeka Nwosu', 'emeka@hellenstore.com', 'INVENTORY', TRUE, '5555')
ON CONFLICT (email) DO NOTHING;

-- 2. Initial Categories
INSERT INTO categories (id, name, description, active)
VALUES
  ('cat_groceries', 'Groceries & Staples', 'Flour, rice, grains, sugar, spices and pantry essentials', TRUE),
  ('cat_beverages', 'Beverages & Drinks', 'Juices, water, soft drinks, milk, tea and coffee', TRUE),
  ('cat_bakery', 'Bakery & Snacks', 'Fresh bread, pastries, biscuits, crisps and confectionery', TRUE),
  ('cat_toiletries', 'Household & Toiletries', 'Soaps, detergents, toiletries, and cleaning supplies', TRUE),
  ('cat_dairy', 'Dairy & Chilled', 'Eggs, cheese, butter, yoghurts and chilled food', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Initial Products
INSERT INTO products (id, name, category_id, sku, barcode, selling_price, cost_price, stock_quantity, min_stock_threshold, active)
VALUES
  ('prod_1', 'Mama Gold Parboiled Rice 5kg', 'cat_groceries', 'MGR-005', '6151234567890', 9500.00, 8200.00, 28, 10, TRUE),
  ('prod_2', 'Golden Penny Semovita 2kg', 'cat_groceries', 'GPS-002', '6152345678901', 3400.00, 2900.00, 4, 10, TRUE),
  ('prod_3', 'Dangote Refined Sugar 1kg', 'cat_groceries', 'DRS-001', '6153456789012', 2200.00, 1900.00, 45, 12, TRUE),
  ('prod_4', 'Kings Pure Vegetable Oil 1L', 'cat_groceries', 'KVO-001', '6154567890123', 3800.00, 3200.00, 18, 8, TRUE),
  ('prod_5', 'Indomie Instant Noodles Super Pack (120g x 10)', 'cat_groceries', 'IND-010', '6155678901234', 4800.00, 4200.00, 5, 15, TRUE),
  ('prod_6', 'Peak Full Cream Milk Powder 400g Tin', 'cat_beverages', 'PKM-400', '6156789012345', 4500.00, 3900.00, 0, 8, TRUE),
  ('prod_7', 'Milo Cocoa Beverage Refill 500g', 'cat_beverages', 'MLO-500', '6157890123456', 4100.00, 3500.00, 22, 10, TRUE),
  ('prod_8', 'Coca-Cola Original 50cl PET (Pack of 12)', 'cat_beverages', 'COK-500', '6158901234567', 4200.00, 3600.00, 34, 10, TRUE),
  ('prod_9', 'Chi Exotic Pineapple Juice 1L', 'cat_beverages', 'CEX-001', '6159012345678', 2100.00, 1750.00, 15, 6, TRUE),
  ('prod_10', 'Eva Bottled Mineral Water 75cl (Pack of 12)', 'cat_beverages', 'EVA-750', '6150123456789', 2800.00, 2300.00, 40, 12, TRUE),
  ('prod_11', 'Hellen Bakery Fresh Sliced Butter Bread 800g', 'cat_bakery', 'HBB-800', '6151122334455', 1600.00, 1100.00, 19, 8, TRUE),
  ('prod_12', 'McVitie Digestive Biscuits 400g', 'cat_bakery', 'MVD-400', '6152233445566', 1950.00, 1550.00, 26, 10, TRUE),
  ('prod_13', 'Pringles Potato Crisps Sour Cream 165g', 'cat_bakery', 'PNG-165', '6153344556677', 3200.00, 2600.00, 14, 6, TRUE),
  ('prod_14', 'Ariel Automatic Detergent Powder 900g', 'cat_toiletries', 'ARL-900', '6154455667788', 3100.00, 2500.00, 30, 10, TRUE),
  ('prod_15', 'Dettol Original Antiseptic Bath Soap (110g x 3)', 'cat_toiletries', 'DTL-330', '6155566778899', 2600.00, 2100.00, 24, 8, TRUE),
  ('prod_16', 'Sunlight Lemon Dishwashing Liquid 750ml', 'cat_toiletries', 'SNL-750', '6156677889900', 1850.00, 1450.00, 16, 6, TRUE),
  ('prod_17', 'Fresh Farm Grade A Eggs (Full Crate 30s)', 'cat_dairy', 'EGG-030', '6157788990011', 5200.00, 4400.00, 12, 6, TRUE),
  ('prod_18', 'Hollandia Plain Sweetened Yoghurt 1L', 'cat_dairy', 'HLY-001', '6158899001122', 2400.00, 1950.00, 20, 8, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Initial Default Business Settings
INSERT INTO business_settings (
  id, store_name, branch_name, phone, address, currency, receipt_footer,
  tax_rate, enable_tax, low_stock_global_threshold, timezone, bank_name, account_name, account_number
)
VALUES (
  'default',
  'Hellen Store',
  'Main Supermarket Branch',
  '+234 802 345 6789',
  '14 Commercial Avenue, Yaba, Lagos',
  '₦',
  'Thank you for shopping at Hellen Store! Please retain receipt for exchange within 48hrs.',
  0.00,
  FALSE,
  10,
  'Africa/Lagos',
  'GTBank / Access Bank',
  'Hellen Store Enterprise',
  '0123456789'
)
ON CONFLICT (id) DO NOTHING;
