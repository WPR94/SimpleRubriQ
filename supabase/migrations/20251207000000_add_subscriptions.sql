-- Add plan column to profiles table if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE profiles ADD COLUMN plan TEXT DEFAULT 'free';
  END IF;
END $$;

-- Create subscriptions table to track billing
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT, -- e.g., 'active', 'canceled', 'past_due'
  provider TEXT DEFAULT 'stripe',
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE
);

-- Add RLS policies for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Ensure policy can be recreated idempotently
DROP POLICY IF EXISTS "Allow users to view their own subscriptions" ON subscriptions;

CREATE POLICY "Allow users to view their own subscriptions"
ON subscriptions FOR SELECT
USING (auth.uid() = user_id);
