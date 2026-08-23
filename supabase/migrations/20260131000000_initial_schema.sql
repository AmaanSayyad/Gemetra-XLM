/*
  # Initial Schema Setup for Gemetra
  
  Complete database schema including:
  - Users and authentication
  - Employees management
  - Payments and VAT refunds
  - Points system
  - Chat system
  - Notifications
  - Stellar payment fields
*/

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  company_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employees table (with text user_id for wallet addresses)
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  designation text NOT NULL,
  department text NOT NULL DEFAULT 'Engineering',
  salary decimal(10,2) NOT NULL CHECK (salary > 0),
  wallet_address text NOT NULL CHECK (length(wallet_address) >= 40),
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add legacy_eth_address if it exists from older deployments (deprecated, unused by app)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='legacy_eth_address') THEN
    ALTER TABLE employees ADD COLUMN legacy_eth_address text;
  END IF;
END $$;

-- Payments table (with text user_id and employee_id for wallet addresses)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  user_id text NOT NULL,
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  token text NOT NULL DEFAULT 'XLM',
  transaction_hash text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  vat_refund_details jsonb
);

-- Add Stellar payment fields if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='network') THEN
    ALTER TABLE payments ADD COLUMN network text DEFAULT 'stellar';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='stellar_memo') THEN
    ALTER TABLE payments ADD COLUMN stellar_memo text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='stellar_memo_type') THEN
    ALTER TABLE payments ADD COLUMN stellar_memo_type text;
  END IF;
END $$;

-- ============================================================================
-- POINTS SYSTEM
-- ============================================================================

-- User points table
CREATE TABLE IF NOT EXISTS user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Point transactions table
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  points integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned', 'converted', 'expired')),
  source text NOT NULL,
  source_id text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Point conversions table
CREATE TABLE IF NOT EXISTS point_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  points integer NOT NULL,
  xlm_amount decimal(10, 6) NOT NULL,
  conversion_rate decimal(10, 2) NOT NULL,
  transaction_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================================
-- CHAT SYSTEM
-- ============================================================================

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    title text NOT NULL DEFAULT 'New Chat',
    last_message_content text,
    last_message_timestamp timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    type text NOT NULL CHECK (type IN ('user', 'assistant')),
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Align legacy chat_messages (e.g. older MNEE schemas) that lack session_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE chat_messages
      ADD COLUMN session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN user_id text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'type'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN type text CHECK (type IN ('user', 'assistant'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'content'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN content text;
  END IF;
END $$;

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT FALSE,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_employee_id ON payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_vat_refund_details ON payments USING gin (vat_refund_details) WHERE employee_id = 'vat-refund';

-- Points indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_conversions_user_id ON point_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_conversions_status ON point_conversions(status);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers (with IF NOT EXISTS check)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_points_updated_at ON user_points;
CREATE TRIGGER update_user_points_updated_at
  BEFORE UPDATE ON user_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Employees policies (public access, app filters by wallet)
DROP POLICY IF EXISTS "Public can read employees" ON employees;
CREATE POLICY "Public can read employees" ON employees
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert employees" ON employees;
CREATE POLICY "Public can insert employees" ON employees
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update employees" ON employees;
CREATE POLICY "Public can update employees" ON employees
  FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Public can delete employees" ON employees;
CREATE POLICY "Public can delete employees" ON employees
  FOR DELETE TO public USING (true);

-- Payments policies
DROP POLICY IF EXISTS "Anyone can read VAT refunds" ON payments;
CREATE POLICY "Anyone can read VAT refunds" ON payments
  FOR SELECT TO public USING (employee_id = 'vat-refund');

DROP POLICY IF EXISTS "Users can insert VAT refunds" ON payments;
CREATE POLICY "Users can insert VAT refunds" ON payments
  FOR INSERT TO public WITH CHECK (employee_id = 'vat-refund');

DROP POLICY IF EXISTS "Users can update VAT refunds" ON payments;
CREATE POLICY "Users can update VAT refunds" ON payments
  FOR UPDATE TO public USING (employee_id = 'vat-refund');

DROP POLICY IF EXISTS "Users can read payments for own employees" ON payments;
CREATE POLICY "Users can read payments for own employees" ON payments
  FOR SELECT TO public USING (employee_id != 'vat-refund');

DROP POLICY IF EXISTS "Users can insert payments for own employees" ON payments;
CREATE POLICY "Users can insert payments for own employees" ON payments
  FOR INSERT TO public WITH CHECK (employee_id != 'vat-refund');

DROP POLICY IF EXISTS "Users can update payments for own employees" ON payments;
CREATE POLICY "Users can update payments for own employees" ON payments
  FOR UPDATE TO public USING (employee_id != 'vat-refund');

-- Points policies (public access, app filters by wallet)
DROP POLICY IF EXISTS "Public can read user_points" ON user_points;
CREATE POLICY "Public can read user_points" ON user_points
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert user_points" ON user_points;
CREATE POLICY "Public can insert user_points" ON user_points
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update user_points" ON user_points;
CREATE POLICY "Public can update user_points" ON user_points
  FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Public can read point_transactions" ON point_transactions;
CREATE POLICY "Public can read point_transactions" ON point_transactions
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert point_transactions" ON point_transactions;
CREATE POLICY "Public can insert point_transactions" ON point_transactions
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read point_conversions" ON point_conversions;
CREATE POLICY "Public can read point_conversions" ON point_conversions
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert point_conversions" ON point_conversions;
CREATE POLICY "Public can insert point_conversions" ON point_conversions
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update point_conversions" ON point_conversions;
CREATE POLICY "Public can update point_conversions" ON point_conversions
  FOR UPDATE TO public USING (true);

-- Chat policies (public access, app filters by wallet)
DROP POLICY IF EXISTS "Public can read chat_sessions" ON chat_sessions;
CREATE POLICY "Public can read chat_sessions" ON chat_sessions
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert chat_sessions" ON chat_sessions;
CREATE POLICY "Public can insert chat_sessions" ON chat_sessions
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update chat_sessions" ON chat_sessions;
CREATE POLICY "Public can update chat_sessions" ON chat_sessions
  FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Public can delete chat_sessions" ON chat_sessions;
CREATE POLICY "Public can delete chat_sessions" ON chat_sessions
  FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Public can read chat_messages" ON chat_messages;
CREATE POLICY "Public can read chat_messages" ON chat_messages
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert chat_messages" ON chat_messages;
CREATE POLICY "Public can insert chat_messages" ON chat_messages
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete chat_messages" ON chat_messages;
CREATE POLICY "Public can delete chat_messages" ON chat_messages
  FOR DELETE TO public USING (true);

-- Notifications policies (public access, app filters by wallet)
DROP POLICY IF EXISTS "Public can read notifications" ON notifications;
CREATE POLICY "Public can read notifications" ON notifications
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert notifications" ON notifications;
CREATE POLICY "Public can insert notifications" ON notifications
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update notifications" ON notifications;
CREATE POLICY "Public can update notifications" ON notifications
  FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Public can delete notifications" ON notifications;
CREATE POLICY "Public can delete notifications" ON notifications
  FOR DELETE TO public USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN payments.vat_refund_details IS 'JSONB object containing VAT refund form details: vatRegNo, receiptNo, billAmount, vatAmount, passportNo, flightNo, nationality, dob, purchaseDate, merchantName, merchantAddress, receiverWalletAddress';
COMMENT ON COLUMN payments.network IS 'Stellar network: mainnet or testnet';
COMMENT ON COLUMN payments.token IS 'Settlement asset (XLM)';
COMMENT ON COLUMN payments.stellar_memo IS 'Stellar transaction memo';
COMMENT ON COLUMN payments.stellar_memo_type IS 'Stellar memo type: text, id, hash, return';
COMMENT ON COLUMN employees.legacy_eth_address IS 'Deprecated legacy column from pre-Stellar deployments';
