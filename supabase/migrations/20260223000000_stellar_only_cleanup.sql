/*
  # Stellar-only cleanup

  Aligns database defaults and column names with Stellar/XLM-only architecture.
*/

-- Payments: default to XLM on Stellar
ALTER TABLE payments ALTER COLUMN token SET DEFAULT 'XLM';

UPDATE payments SET token = 'XLM' WHERE token IN ('MNEE', 'mnee', 'BOT', 'USDT');

ALTER TABLE payments ALTER COLUMN network SET DEFAULT 'stellar';
UPDATE payments SET network = 'stellar' WHERE network IS NULL OR network = 'ethereum';

-- Point conversions: rename legacy MNEE column to xlm_amount when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'point_conversions' AND column_name = 'mnee_amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'point_conversions' AND column_name = 'xlm_amount'
  ) THEN
    ALTER TABLE point_conversions RENAME COLUMN mnee_amount TO xlm_amount;
  END IF;
END $$;

COMMENT ON COLUMN payments.network IS 'Stellar network: mainnet or testnet';
COMMENT ON COLUMN payments.token IS 'Settlement asset (XLM)';
