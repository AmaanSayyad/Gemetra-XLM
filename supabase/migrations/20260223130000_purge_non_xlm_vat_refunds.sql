/*
  # Purge legacy non-XLM VAT refund test data

  Removes PUSD, SOL, and other multi-chain junk rows that were incorrectly
  stored with employee_id = 'vat-refund'. Keeps only XLM claims tied to
  valid Stellar public keys (G...).
*/

DELETE FROM payments
WHERE employee_id = 'vat-refund'
  AND (
    UPPER(COALESCE(token, '')) <> 'XLM'
    OR user_id !~ '^G[A-Z2-7]{55}$'
  );
