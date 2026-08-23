/*
  # Admin cancel + claim blacklist

  - Extends payment status with cancelled / blacklisted
  - claim_blacklist blocks wallets (and optional passport) from new claims
*/

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'blacklisted'));

CREATE TABLE IF NOT EXISTS claim_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  passport_no text,
  reason text NOT NULL,
  blacklisted_by text NOT NULL,
  source_payment_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_blacklist_wallet ON claim_blacklist (wallet_address);

CREATE INDEX IF NOT EXISTS idx_claim_blacklist_passport
  ON claim_blacklist (passport_no)
  WHERE passport_no IS NOT NULL;

ALTER TABLE claim_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read claim blacklist" ON claim_blacklist;
CREATE POLICY "Public read claim blacklist" ON claim_blacklist
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public insert claim blacklist" ON claim_blacklist;
CREATE POLICY "Public insert claim blacklist" ON claim_blacklist
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete claim blacklist" ON claim_blacklist;
CREATE POLICY "Public delete claim blacklist" ON claim_blacklist
  FOR DELETE TO public USING (true);

COMMENT ON TABLE claim_blacklist IS 'Wallets/passports blocked from submitting VAT refund claims';
