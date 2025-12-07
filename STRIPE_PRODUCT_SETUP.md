# Stripe Product Setup Guide - Simple Rubriq

Complete step-by-step guide for creating all 6 products in Stripe Dashboard.

---

## 📊 Pricing Overview

### Teacher Plans (Monthly)

| Plan | Amount | Billing | Pricing model | Per | Tax Code |
|------|--------|---------|---------------|-----|----------|
| Free | £0 | Monthly | Standard | 1 | TX-02010201 |
| Teacher Pro | £6.99 | Monthly | Standard | 1 | TX-02010201 |
| Teacher Pro+ | £12.99 | Monthly | Standard | 1 | TX-02010201 |

### School Plans (Yearly)

| Plan | Amount | Billing | Pricing model | Per | Accounts | Tax Code |
|------|--------|---------|---------------|-----|----------|----------|
| Small School | £350 | Yearly | Package | 1 | 5 | TX-02010201 |
| Medium School | £650 | Yearly | Package | 1 | 15 | TX-02010201 |
| Large School | £1,200 | Yearly | Package | 1 | 30 | TX-02010201 |

---

## 🔑 Your Price IDs

After creating products, you received these Price IDs:

```bash
# Teacher Plans
PRICE_ID_TEACHER_PRO=price_1Sbp8mA69W11YVzZjzWhq9jj
PRICE_ID_TEACHER_PRO_PLUS=price_1Sbp9dA69W11YVzZF34j0zWf

# School Plans
PRICE_ID_SMALL_SCHOOL=price_1SbpAzA69W11YVzZRRyKjCWO
PRICE_ID_MEDIUM_SCHOOL=price_1SbpCNA69W11YVzZSGJCjUZ9
PRICE_ID_LARGE_SCHOOL=price_1SbpCxA69W11YVzZ3UsdxRyZ
```

---

## 🟦 1. Product: Simple Rubriq – Free Plan

### Product Details
1. Go to **Stripe Dashboard** → **Products** → **Add Product**
2. Fill in:
   - **Name**: `Simple Rubriq – Free Plan`
   - **Description**: 
     ```
     A free plan for teachers to try Simple Rubriq with limited daily usage.
     
     Features:
     • 3 AI feedback generations per day
     • 1 saved rubric
     • Basic essay feedback
     • Limited OCR
     • Basic uploads only
     • No history dashboard
     • Watermarked reports
     ```
   - **Type**: Recurring
   - **Tax code**: TX-02010201

### Pricing
- **Pricing model**: Standard pricing (NOT package pricing)
- **Price**: £0.00
- **Billing period**: Monthly
- **Per**: 1 unit

### After Creating
- ✅ No Price ID needed (free tier doesn't use checkout)
- This product is for display/documentation purposes only

---

## 🟩 2. Product: Simple Rubriq – Teacher Pro

### Product Details
1. **Products** → **Add Product**
2. Fill in:
   - **Name**: `Simple Rubriq – Teacher Pro`
   - **Description**:
     ```
     Full access for individual teachers needing unlimited AI marking.
     
     Features:
     • Unlimited AI feedback
     • Unlimited rubrics
     • Full OCR (PDF, DOCX, images)
     • Feedback history dashboard
     • Sentence-level rubric alignment
     • PDF + text exports
     • Priority processing
     • Email support
     ```
   - **Type**: Recurring
   - **Tax code**: TX-02010201

### Pricing
- **Pricing model**: Standard pricing
- **Price**: £6.99
- **Billing period**: Monthly
- **Per**: 1 unit

### After Creating
- **✅ COPY THE PRICE ID** (starts with `price_...`)
- You'll need this for `PRICE_ID_TEACHER_PRO` environment variable

---

## 🟧 3. Product: Simple Rubriq – Teacher Pro+

### Product Details
1. **Products** → **Add Product**
2. Fill in:
   - **Name**: `Simple Rubriq – Teacher Pro+`
   - **Description**:
     ```
     For power users who need analytics, batch grading, and advanced tools.
     
     Includes everything in Teacher Pro, plus:
     • Class/department analytics
     • Rubric mastery insights
     • Batch grading (30–100 essays at once)
     • LMS/CSV export
     • Priority compute queue
     • Early access to beta features
     ```
   - **Type**: Recurring
   - **Tax code**: TX-02010201

### Pricing
- **Pricing model**: Standard pricing
- **Price**: £12.99
- **Billing period**: Monthly
- **Per**: 1 unit

### After Creating
- **✅ COPY THE PRICE ID** (starts with `price_...`)
- You'll need this for `PRICE_ID_TEACHER_PRO_PLUS` environment variable

---

## 🟨 SCHOOL / DEPARTMENT PLANS

**Important**: These use **Package Pricing** because they are fixed annual fees per school with seat limits.

---

## 🟦 4. Product: Simple Rubriq – Small School Plan

### Product Details
1. **Products** → **Add Product**
2. Fill in:
   - **Name**: `Simple Rubriq – Small School Plan`
   - **Description**:
     ```
     School licence for small English departments.
     
     Limit: Up to 5 teacher accounts
     
     Features:
     • All Teacher Pro+ features for all included teachers
     • Shared rubric library
     • School admin dashboard
     • Department analytics
     • Usage reporting
     • Priority onboarding & email support
     ```
   - **Type**: Recurring
   - **Tax code**: TX-02010201

### Pricing
- **Pricing model**: ⚠️ **Package pricing**
- **Price**: £350.00
- **Billing period**: Yearly
- **Per**: 1 unit

### Notes
- This is for **1-5 teachers**
- Sold via custom sales flow or manual invoice
- Not automatically available via self-service checkout

---

## 🟧 5. Product: Simple Rubriq – Medium School Plan

### Product Details
1. **Products** → **Add Product**
2. Fill in:
   - **Name**: `Simple Rubriq – Medium School Plan`
   - **Description**:
     ```
     School licence for medium-sized English departments.
     
     Limit: Up to 15 teacher accounts
     
     Features:
     • All Small School Plan features
     • Extra analytics capabilities
     • Larger shared rubric pools
     ```
   - **Type**: Recurring
   - **Tax code**: TX-02010201

### Pricing
- **Pricing model**: ⚠️ **Package pricing**
- **Price**: £650.00
- **Billing period**: Yearly
- **Per**: 1 unit

### Notes
- This is for **6-15 teachers**
- Best value for mid-sized departments

---

## 🟩 6. Product: Simple Rubriq – Large School Plan

### Product Details
1. **Products** → **Add Product**
2. Fill in:
   - **Name**: `Simple Rubriq – Large School Plan`
   - **Description**:
     ```
     School licence for large English departments and multi-department schools.
     
     Limit: Up to 30 teacher accounts
     
     Features:
     • All Medium School Plan features
     • Dedicated support channel
     • Largest shared rubric library
     • Feature rollout priority
     ```
   - **Type**: Recurring
   - **Tax code**: TX-02010201

### Pricing
- **Pricing model**: ⚠️ **Package pricing**
- **Price**: £1,200.00
- **Billing period**: Yearly
- **Per**: 1 unit

### Notes
- This is for **16-30 teachers**
- Premium tier with white-glove support

---

## 📋 Quick Setup Checklist

After creating all products, you'll have:

### Individual Plans (Self-Service Checkout)
- [ ] ✅ Simple Rubriq – Free Plan (£0/month) - Display only
- [ ] ✅ Simple Rubriq – Teacher Pro (£6.99/month) - **COPY PRICE ID**
- [ ] ✅ Simple Rubriq – Teacher Pro+ (£12.99/month) - **COPY PRICE ID**

### School Plans (Contact Sales / Manual Setup)
- [ ] ✅ Simple Rubriq – Small School Plan (£350/year, 1-5 teachers)
- [ ] ✅ Simple Rubriq – Medium School Plan (£650/year, 6-15 teachers)
- [ ] ✅ Simple Rubriq – Large School Plan (£1,200/year, 16-30 teachers)

---

## 🔧 Configure Environment Variables

Set your Price IDs in Supabase (run these commands from the `markmate/` directory):

```bash
# Teacher Plans (Required for self-service checkout)
npx supabase secrets set PRICE_ID_TEACHER_PRO=price_1Sbp8mA69W11YVzZjzWhq9jj
npx supabase secrets set PRICE_ID_TEACHER_PRO_PLUS=price_1Sbp9dA69W11YVzZF34j0zWf

# School Plans (Optional - for custom sales flow)
npx supabase secrets set PRICE_ID_SMALL_SCHOOL=price_1SbpAzA69W11YVzZRRyKjCWO
npx supabase secrets set PRICE_ID_MEDIUM_SCHOOL=price_1SbpCNA69W11YVzZSGJCjUZ9
npx supabase secrets set PRICE_ID_LARGE_SCHOOL=price_1SbpCxA69W11YVzZ3UsdxRyZ
```

### Verify Secrets Were Set

```bash
npx supabase secrets list
```

You should see all 5 Price IDs listed (values will be hidden for security).

---

## 🏫 School Plan Sales Process

School plans are **NOT available via self-service checkout**. They require:

1. **Initial Contact**: School emails `sales@simplerubriq.com`
2. **Discovery Call**: Understand their needs, number of teachers, budget
3. **Quote**: Provide written quote with appropriate plan (Small/Medium/Large)
4. **Contract**: Send DPA, terms, compliance documents
5. **Manual Setup**: 
   - Create Stripe subscription manually
   - Or send payment link for selected plan
   - Provision teacher accounts via admin dashboard
6. **Onboarding**: Bulk user setup, training sessions, shared rubric setup

---

## 💡 Pro Tips

### Tax Code TX-02010201
This is Stripe's code for **Software as a Service (SaaS)** which handles:
- UK VAT (20%)
- Reverse charge for EU businesses
- Automatic tax calculation for international sales

### Package Pricing vs Standard Pricing
- **Standard Pricing**: Pay per seat/user (used for Teacher Pro, Pro+)
- **Package Pricing**: Fixed price regardless of usage within limits (used for School Plans)

### Price ID vs Product ID
- **Product ID**: Starts with `prod_...` (used for organization/grouping)
- **Price ID**: Starts with `price_...` (THIS is what you need for checkout)

---

## 🎯 Next Steps After Setup

1. ✅ All 6 products created in Stripe
2. ✅ Price IDs configured in Supabase secrets
3. ✅ Database migration applied (`20251207000000_add_subscriptions.sql`)
4. ✅ Edge Functions deployed (`create-checkout`, `stripe-webhook`)
5. ✅ Webhook endpoint configured in Stripe Dashboard
6. 🚀 **Test the checkout flow** with Stripe test card: `4242 4242 4242 4242`

---

## 📊 Expected Revenue Breakdown

| Plan | Price | Stripe Fee (1.5% + 20p) | OpenAI Cost | Net Profit |
|------|-------|-------------------------|-------------|------------|
| Free | £0 | £0 | ~£0.15/day | -£4.50/month |
| Teacher Pro | £6.99 | £0.30 | £1.40 | **£5.29/month** |
| Teacher Pro+ | £12.99 | £0.39 | £2.09 | **£10.51/month** |
| Small School (5 teachers) | £350/year | £5.45 | £35/year | **£309.55/year** |
| Medium School (15 teachers) | £650/year | £10.15 | £105/year | **£534.85/year** |
| Large School (30 teachers) | £1,200/year | £18.20 | £210/year | **£971.80/year** |

---

## ✅ You're All Set!

Your Stripe product catalog is now complete and ready to accept payments! 🎉
