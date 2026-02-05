# Pricing Strategy

## Current State

- **Price**: ₹199 one-time (~$2.40 USD)
- **Model**: Freemium with one-time lifetime unlock
- **Payment Provider**: Dodo Payments

### Current Tier Structure

| Feature | Free | Paid (₹199) |
|---------|------|-------------|
| Saved subreddits | 5 | Unlimited |
| Subreddits per post | 5 | Unlimited |
| All core features | ✓ | ✓ |

---

## Pricing Analysis

### One-Time Payment (Current Model)

**Pros:**
- Zero friction - no commitment fear
- Works well in price-sensitive markets
- "Pay once, own forever" is compelling
- No churn to manage
- Simple to explain

**Cons:**
- Limited lifetime value (LTV)
- Can't fund ongoing development long-term
- Need constant new customer acquisition
- Hard to introduce new paid tiers later
- Early adopters get everything forever

**Best for**: Getting initial traction, validating product-market fit

### Subscription Model (Alternative)

**Pros:**
- Recurring revenue = predictable
- Higher LTV per customer
- Aligns incentives (you improve, they pay)
- Easier to add premium tiers
- Better for raising funding

**Cons:**
- Higher friction (commitment anxiety)
- Churn is a constant battle
- Must continuously prove value
- Indian market is subscription-fatigued
- More complex billing/cancellation flows

**Best for**: Long-term sustainable business, continuous feature development

---

## Recommended Strategy: Phased Approach

### Phase 1: Keep One-Time (Current - Month 1-2)

**Rationale**: Still validating product-market fit. One-time payment removes friction.

**Actions:**
- [ ] Keep ₹199 one-time pricing
- [ ] Add urgency: "Launch pricing ends [date]"
- [ ] Collect testimonials from paying users
- [ ] Track conversion rates and user behavior

### Phase 2: Price Increase + Premium Features (Month 3-4)

**Actions:**
- [ ] Raise price to ₹299-399 for new users
- [ ] Add premium features to justify higher price:
  - Scheduled posting
  - Post templates
  - Advanced analytics
- [ ] Grandfather existing paid users at ₹199

### Phase 3: Hybrid Model (Month 6+)

Introduce subscription alongside lifetime option:

```
┌─────────────────────────────────────────────────────┐
│  FREE           │  PRO Monthly    │  PRO Lifetime   │
│  ₹0             │  ₹49/month      │  ₹499 one-time  │
├─────────────────┼─────────────────┼─────────────────┤
│  5 subreddits   │  Unlimited      │  Unlimited      │
│  5 per post     │  Unlimited      │  Unlimited      │
│  No scheduling  │  Scheduling     │  Scheduling     │
│  Basic stats    │  Full analytics │  Full analytics │
│  1 template     │  Unlimited      │  Unlimited      │
│                 │                 │  + Early adopter│
│                 │                 │    badge        │
└─────────────────┴─────────────────┴─────────────────┘
```

**Why this works:**
- Monthly appeals to "try before committing" users
- Lifetime appeals to subscription-haters
- Lifetime at 10x monthly = breakeven at 10 months (good ratio)
- Captures both user psychologies

---

## International Pricing (Future)

| Region | One-Time | Monthly | Annual |
|--------|----------|---------|--------|
| India (INR) | ₹499 | ₹49/mo | ₹299/yr |
| US/EU (USD) | $9.99 | $2.99/mo | $19.99/yr |
| Other | $4.99 | $1.99/mo | $14.99/yr |

**Implementation**: Use geo-based pricing via Dodo Payments or Stripe.

---

## Conversion Optimization

### Feature-Based Limits (Current + Proposed)

| Feature | Free Limit | Paid Unlock | Conversion Trigger |
|---------|------------|-------------|-------------------|
| Saved subreddits | 5 | Unlimited | At limit |
| Subreddits per post | 5 | Unlimited | Selecting 6th |
| Post templates | 3 | Unlimited | Creating 4th |
| Scheduled posts | 1 | Unlimited | Scheduling 2nd |
| Drafts | 1 | Unlimited | Saving 2nd |
| Analytics history | 7 days | Full history | Viewing older data |

### Pricing Psychology

1. **Anchor High, Offer Low**
   > "Save 10+ hours/month posting to Reddit"
   > "Worth ₹2,000+/month in time saved"
   > "Get it for just ₹199"

2. **Urgency (Ethical)**
   - "Launch price - increases to ₹399 on [date]"
   - "First 500 users get lifetime access"

3. **Annual vs Monthly Push**
   ```
   Monthly: ₹49/month
   Annual:  ₹299/year (save 50%!) ← Highlight this
   ```

---

## Metrics to Track

### Conversion Metrics
- Free → Paid conversion rate
- Time to conversion (days from signup)
- Conversion trigger point (which limit?)
- Price elasticity (A/B test different prices)

### Revenue Metrics
- Monthly Recurring Revenue (MRR) - if subscription
- Average Revenue Per User (ARPU)
- Customer Lifetime Value (LTV)
- Churn rate (subscription only)

### Usage Metrics
- Posts per user per week
- Feature usage by tier
- Upgrade modal impressions → conversions

---

## Competitor Pricing Reference

| Tool | Pricing Model | Price Range |
|------|---------------|-------------|
| Later (social scheduler) | Subscription | $18-80/mo |
| Buffer | Subscription | $6-120/mo |
| Hootsuite | Subscription | $99-739/mo |
| Bulk Reddit Poster (generic) | One-time | $29-99 |

**Insight**: Your ₹199 (~$2.40) is significantly cheaper than alternatives. Room to increase.

---

## Decision Framework

| Situation | Recommended Action |
|-----------|-------------------|
| Need cash flow NOW | Stick with one-time, raise price |
| Building for long-term/funding | Move to subscription + lifetime |
| Mostly Indian users | Keep prices low, one-time works better |
| Getting international users | Add USD pricing tier |
| Want to test without risk | Keep one-time, add subscription as option |

---

## Next Steps

1. [ ] Decide on Phase 2 timeline
2. [ ] Implement premium features (scheduling, templates)
3. [ ] Set up A/B testing for price points
4. [ ] Create email campaign for price increase announcement
5. [ ] Plan grandfather policy for existing users
