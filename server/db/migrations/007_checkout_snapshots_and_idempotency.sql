ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS selling_unit VARCHAR(16) NOT NULL DEFAULT 'BASE',
  ADD COLUMN IF NOT EXISTS selling_unit_name VARCHAR(64) NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS conversion_factor INTEGER NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  ADD COLUMN IF NOT EXISTS price_tier VARCHAR(16) NOT NULL DEFAULT 'RETAIL' CHECK (price_tier IN ('RETAIL', 'WHOLESALE'));

CREATE TABLE IF NOT EXISTS checkout_idempotency (
  idempotency_key VARCHAR(128) PRIMARY KEY,
  payload_hash CHAR(64) NOT NULL,
  sale_id VARCHAR(64) REFERENCES sales(id) ON DELETE CASCADE,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_idempotency_created_at
  ON checkout_idempotency(created_at);