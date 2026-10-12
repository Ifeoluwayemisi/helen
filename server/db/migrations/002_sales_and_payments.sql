-- ====================================================================
-- Hellen Store POS & Inventory: Migration 002_sales_and_payments.sql
-- Transaction Tables: sales, sale_items, payments
-- ====================================================================

-- 1. Sales table (Completed and documented point-of-sale transactions)
CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(64) PRIMARY KEY,
  receipt_number VARCHAR(64) NOT NULL UNIQUE,
  cashier_id UUID REFERENCES users(id) ON UPDATE CASCADE,
  cashier_name VARCHAR(255) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
  discount_type VARCHAR(16) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid >= 0),
  change_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0),
  payment_method VARCHAR(32) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'POS_CARD')),
  payment_reference VARCHAR(255),
  payment_confirmed_by VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED', 'REFUNDED')),
  idempotency_key VARCHAR(128) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key);

-- 2. Sale items table (Immutable transaction line item snapshots)
CREATE TABLE IF NOT EXISTS sale_items (
  id VARCHAR(64) PRIMARY KEY,
  sale_id VARCHAR(64) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  cost_price_snapshot NUMERIC(12,2) CHECK (cost_price_snapshot IS NULL OR cost_price_snapshot >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- 3. Payments table (Payment records associated with transactions)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  sale_id VARCHAR(64) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method VARCHAR(32) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'POS_CARD')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_reference VARCHAR(255),
  confirmed_by VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
