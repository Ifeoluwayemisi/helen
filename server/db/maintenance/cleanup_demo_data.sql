-- ====================================================================
-- Hellen Store POS & Inventory: cleanup_demo_data.sql
--
-- Removes the sample/seed data that migration 004_demo_seed.sql wrote into
-- the database, so a production database holds only real business records.
--
-- Removes:
--   * the three demo staff accounts (Hellen / Blessing / Emeka) and their
--     sessions (their scrypt password hashes from migration 005 made them
--     fully loginable in production);
--   * the 18 demo products seeded by migration 004;
--   * any demo category left unreferenced after the products are removed
--     (a category still used by a real product is kept);
--   * optionally the test sale created while verifying checkout.
--
-- Keeps:
--   * the provisioned owner account (destinifeoluwa@gmail.com);
--   * every product/record created through the app;
--   * audit history (rows lose only the now-deleted user attribution);
--   * business_settings (review the store name / phone / bank details and
--     update them from Settings — they still hold seed defaults).
--
-- Safe to run more than once (idempotent: deletes only what is still present).
-- ====================================================================

BEGIN;

-- 1. Sessions belonging to the demo staff ------------------------------
DELETE FROM sessions
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN (
    'hellen@hellenstore.com',
    'blessing@hellenstore.com',
    'emeka@hellenstore.com'
  )
);

-- 2. Demo staff accounts -----------------------------------------------
-- Guarded so a real staff member who later reuses one of these emails is not
-- removed; matches only the exact seeded UUIDs.
DELETE FROM users
WHERE (id, email) IN (
  ('a0000000-0000-0000-0000-000000000001', 'hellen@hellenstore.com'),
  ('a0000000-0000-0000-0000-000000000002', 'blessing@hellenstore.com'),
  ('a0000000-0000-0000-0000-000000000003', 'emeka@hellenstore.com')
);

-- 3. Demo products -----------------------------------------------------
-- Explicit seed IDs. Skips anything that already has business rows attached,
-- so a demo product that was later sold or received is retained.
DELETE FROM products
WHERE id IN (
  'prod_1','prod_2','prod_3','prod_4','prod_5','prod_6',
  'prod_7','prod_8','prod_9','prod_10','prod_11','prod_12',
  'prod_13','prod_14','prod_15','prod_16','prod_17','prod_18'
)
AND NOT EXISTS (SELECT 1 FROM sale_items      WHERE product_id = products.id)
AND NOT EXISTS (SELECT 1 FROM stock_movements WHERE product_id = products.id);

-- 4. Demo categories that are now unused -------------------------------
-- Kept if any remaining (real) product still references them.
DELETE FROM categories c
WHERE c.id IN (
  'cat_groceries','cat_beverages','cat_bakery','cat_toiletries','cat_dairy'
)
AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id);

COMMIT;

-- 5. (Optional) remove the checkout smoke-test sale --------------------
-- Uncomment to delete the sale recorded while verifying the checkout flow.
-- Cascades to its sale_items / payments / checkout_idempotency; the linked
-- stock movement keeps its row with transaction_id set to NULL.
-- DELETE FROM sales WHERE id = 'sale_980eed78-40ba-4634-bd33-78651b000319';
