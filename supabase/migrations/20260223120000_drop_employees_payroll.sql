-- Remove payroll schema; Gemetra is VAT-only

DROP POLICY IF EXISTS "Users can view their own employee payments" ON payments;
DROP POLICY IF EXISTS "Users can insert their own employee payments" ON payments;
DROP POLICY IF EXISTS "Users can update their own employee payments" ON payments;

DROP TABLE IF EXISTS employees CASCADE;
