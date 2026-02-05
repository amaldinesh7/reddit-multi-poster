# Dodo Payments Setup – Steps for You

This doc lists the **manual steps** you need to do to go live with ₹199 one-time pricing and paid-tier limits (5 subreddits, 5 posts, no temporary selection).

---

## 1. Run the database migration

Apply the new entitlement columns to your `users` table:

```bash
npm run db:migrate
# or: npx supabase migration up
```

This adds `entitlement`, `dodo_payment_id`, and `paid_at` to `users`.

---

## 2. Create a Dodo Payments account and product

1. Sign up at [app.dodopayments.com](https://app.dodopayments.com/signup).
2. In the dashboard, create a **one-time product**:
   - **Pricing type**: Single Payment
   - **Price**: **₹199**
   - **Currency**: **INR** (so India domestic rate 4% + ₹4 applies)
   - **Product name / description**: e.g. "Reddit Multi Poster – Full access"
3. Copy the **Product ID** (e.g. `pdt_xxxxx`).

---

## 3. Get API key and webhook secret

1. In Dodo Dashboard go to **Settings** (or API / Developers) and create or copy:
   - **API Key** (for creating checkout sessions)
   - **Webhook Secret** (for verifying webhooks)
2. For **test mode** use test keys; for **live** use live keys.

---

## 4. Configure environment variables

Add these to your `.env` (or hosting env) and **never commit** them:

```env
# Dodo Payments
DODO_PAYMENTS_API_KEY=your_api_key_here
DODO_PAYMENTS_WEBHOOK_SECRET=your_webhook_secret_here
DODO_PAYMENTS_PRODUCT_ID=pdt_xxxxx
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_RETURN_URL=https://yourdomain.com/checkout/success
```

- **DODO_PAYMENTS_ENVIRONMENT**: `test_mode` for testing, `live_mode` for production.
- **DODO_PAYMENTS_RETURN_URL**: Full URL of your success page (e.g. `https://yourdomain.com/checkout/success`).

---

## 5. Register the webhook in Dodo

1. In Dodo Dashboard go to **Settings → Webhooks** (or **Developers → Webhooks**).
2. **Add webhook** / **Add endpoint**.
3. **Endpoint URL**: `https://yourdomain.com/api/webhooks/dodo`
4. **Events**: Subscribe to **payment** events (at least **payment.succeeded**).
5. Copy the **Webhook signing secret** and set it as `DODO_PAYMENTS_WEBHOOK_SECRET` (step 4).
6. Save. For local testing you’ll need a tunnel (e.g. ngrok) and use that URL as the endpoint.

---

## 6. Test the flow

1. Set `DODO_PAYMENTS_ENVIRONMENT=test_mode` and use **test** API key and webhook secret.
2. Log in, click **Upgrade – ₹199**; you should be redirected to Dodo checkout.
3. Complete a test payment (use Dodo’s test card if available).
4. You should be redirected to `/checkout/success`.
5. Confirm in your app (refresh or re-open) that you’re treated as paid (5/5 limits, no temporary selection, no upgrade CTA).
6. In Dodo Dashboard **Webhooks** tab, confirm the `payment.succeeded` event was delivered and returned 200.

---

## 7. Go live

1. Create the **same product** in **live** mode (₹199 INR) if needed.
2. Switch env to `live_mode` and set **live** API key and webhook secret.
3. Update **DODO_PAYMENTS_RETURN_URL** to your production URL.
4. Register the **production** webhook URL (`https://yourdomain.com/api/webhooks/dodo`) in the **live** Dodo project and subscribe to **payment.succeeded**.

---

## 8. Optional: Refunds

If you issue refunds, consider handling the **refund** webhook and setting the user’s `entitlement` back to `free` (and clearing `dodo_payment_id` / `paid_at` if you use them). This is not implemented in the current code; add it in `pages/api/webhooks/dodo.ts` if you need it.

---

## Summary checklist

- [ ] Run migration `005_add_entitlements.sql`
- [ ] Create Dodo account and ₹199 INR one-time product; copy Product ID
- [ ] Set `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_PRODUCT_ID`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_PAYMENTS_RETURN_URL`
- [ ] Register webhook URL in Dodo and subscribe to `payment.succeeded`
- [ ] Test with test mode and a test payment
- [ ] Switch to live mode and live keys when ready
