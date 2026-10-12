-- ====================================================================
-- Hellen Store POS & Inventory: Migration 003_inventory_and_audit.sql
-- Operational Ledger Tables: stock_movements, audit_logs, business_settings
-- ====================================================================

-- 1. Stock movements table (Immutable chronological inventory ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('RECEIVED', 'SALE', 'ADJUSTMENT', 'DAMAGED', 'RETURN')),
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
  resulting_quantity INTEGER NOT NULL CHECK (resulting_quantity >= 0),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  transaction_id VARCHAR(64) REFERENCES sales(id) ON DELETE SET NULL,
  receipt_number VARCHAR(64),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);

-- 2. Audit logs table (Traceable record of critical business actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 3. Business settings table
CREATE TABLE IF NOT EXISTS business_settings (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  store_name VARCHAR(255) NOT NULL DEFAULT 'Hellen Store',
  branch_name VARCHAR(255) NOT NULL DEFAULT 'Main Supermarket Branch',
  phone VARCHAR(64) NOT NULL DEFAULT '+234 802 345 6789',
  address TEXT NOT NULL DEFAULT '14 Commercial Avenue, Yaba, Lagos',
  currency VARCHAR(16) NOT NULL DEFAULT '₦',
  receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping at Hellen Store! Please retain receipt for exchange within 48hrs.',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  enable_tax BOOLEAN NOT NULL DEFAULT FALSE,
  low_stock_global_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_global_threshold >= 0),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
  bank_name VARCHAR(128) DEFAULT 'GTBank / Access Bank',
  account_name VARCHAR(255) DEFAULT 'Hellen Store Enterprise',
  account_number VARCHAR(64) DEFAULT '0123456789',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
