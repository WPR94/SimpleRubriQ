# Stripe Integration - Final Setup Steps

## What We've Built
✅ Database schema for subscriptions (needs manual SQL run in Supabase)
✅ Stripe webhook handler deployed to Supabase
✅ Checkout session creator deployed to Supabase
✅ Frontend upgrade button wired up
✅ Success/cancel pages added

## Quick Setup Checklist

### 1. Apply Database Changes (One-time)
Go to Supabase Dashboard → SQL Editor and run this:

```sql
-- 1) Ensure plan column on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE profiles ADD COLUMN plan TEXT DEFAULT 'free';
  END IF;
END $$;

-- 2) Ensure subscriptions table exists
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT,
  provider TEXT DEFAULT 'stripe',
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE
);

-- 3) RLS + policy
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to view their own subscriptions" ON subscriptions;
CREATE POLICY "Allow users to view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

### 2. Stripe Product Setup
1. Go to Stripe Dashboard → Products → Create Product
2. Name: "SimpleRubriQ Teacher Pro" (or similar)
3. Add a recurring price: £6.99/month
4. Copy the Price ID (starts with `price_...`)

### 3. Set Supabase Secrets
Run these in your terminal (in the `markmate` folder):

```bash
npx supabase secrets set STRIPE_API_KEY=sk_test_YOUR_KEY_HERE
npx supabase secrets set PRICE_ID=price_YOUR_PRICE_ID_HERE
npx supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
npx supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
npx supabase secrets set DEFAULT_ORIGIN=https://yourapp.vercel.app
```

(You already set STRIPE_WEBHOOK_SIGNING_SECRET when you created the webhook in Stripe)

### 4. Webhook Already Configured ✅
You already did this:
- Endpoint URL: https://hyovomyhoxhvhogfvupj.supabase.co/functions/v1/stripe-webhook
- Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
- Signing secret saved in Supabase

### 5. Test the Flow
1. Deploy your app to Vercel (push to git)
2. Visit /pricing on your live site
3. Click "Upgrade Now"
4. Use Stripe test card: 4242 4242 4242 4242, any future date, any CVC
5. Complete checkout
6. You'll be redirected to /checkout/success
7. Check your profiles table - your plan should now be 'teacher_pro'

## How It Works
1. User clicks Upgrade → frontend calls `create-checkout` function
2. Function creates Stripe Checkout Session with user_id in metadata
3. User completes payment on Stripe
4. Stripe sends webhook to `stripe-webhook` function
5. Webhook updates `profiles.plan = 'teacher_pro'` and records subscription
6. Frontend reads `profiles.plan` to enable Pro features

## Troubleshooting
- If checkout fails, check browser console for errors
- Check Supabase Function Logs (Dashboard → Functions → create-checkout/stripe-webhook → Logs)
- Check Stripe Dashboard → Developers → Webhooks → click your endpoint → see recent deliveries
- Ensure all secrets are set correctly

## Next Steps (Optional)
- Add plan-based feature gating in your app (check user.plan in components)
- Add a "Manage Subscription" page using Stripe Customer Portal
- Add usage limits enforcement in Edge Functions
