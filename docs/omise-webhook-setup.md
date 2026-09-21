# Omise webhook setup (Freelancer Premium)

The webhook is what activates Premium when the buyer's browser never comes back
(closed tab after 3-D Secure, lost connection, etc.). Without it, a paid charge
only activates when the buyer returns to the Premium page.

## 1. Server environment
```
OMISE_SECRET_KEY=skey_test_…        # server only, never in the frontend
OMISE_WEBHOOK_SECRET=…              # base64 secret shown when you create the endpoint (step 3)
APP_BASE_URL=https://your-frontend  # 3-D Secure return URL: <APP_BASE_URL>/freelancer-dashboard/premium
SUPABASE_SERVICE_ROLE_KEY=…         # already required for account deletion
```
`OMISE_WEBHOOK_SECRET` unset => the endpoint answers 503 and processes nothing.
(`OMISE_WEBHOOK_ALLOW_UNSIGNED=true` exists for local experiments only. Never set it in production.)

## 2. Database
Run `supabase/freelancer_premium.sql`, then `supabase/premium_hardening.sql`, in the Supabase SQL editor
(the second adds `payment_events`, the race-safe activation function and atomic acceptance).
Deploy the app code **after** the SQL: the new frontend calls `accept_group_application`.

## 3. Register the endpoint in Omise
Dashboard (test mode first) → Webhooks → Add endpoint:
- **URL:** `https://<your-server-host>/api/webhooks/omise`
- **Events:** `charge.complete` (others are acknowledged and ignored)
- Copy the endpoint's **secret** into `OMISE_WEBHOOK_SECRET`.

Omise signs each delivery with `Omise-Signature` / `Omise-Signature-Timestamp`
(HMAC-SHA256 of `<timestamp>.<raw body>` with the base64-decoded secret; two signatures
appear while a secret is being rotated). The server verifies that, rejects timestamps older
than 5 minutes, then **re-fetches the charge from Omise's API** and validates kind, user,
plan, amount (9900 / 99900 satang) and currency (THB) before activating. Nothing in the webhook
body decides the outcome.

## 4. Reconciliation (Omise does not guarantee retries)
- Failures and rejected payments are written to `public.payment_events`
  (`outcome` = `error` / `rejected`; query it in the Supabase dashboard).
- `cd server && npm run reconcile:omise` lists recent Omise charges and activates any paid Premium charge
  that is missing from `subscription_payments`. Idempotent — run it on a schedule (e.g. hourly) or by hand.

## 5. Testing in test mode
`pnpm run test:omise` (needs `skey_test_` / `pkey_test_` keys) exercises success, declines, repeated webhook
delivery, out-of-order/unpaid charges, activation-failure recovery and abandoned 3-D Secure against real Omise
test charges. Omise test cards: success `4242 4242 4242 4242`; insufficient funds `4111 1111 1114 0011`;
stolen/lost `4111 1111 1113 0012`; payment rejected `4111 1111 1111 0014`. 3-D Secure needs 3DS enabled on the
test account (email support@omise.co).
To see Omise itself deliver to your endpoint, expose the server (e.g. `ngrok http 4000`), register that URL and
make a test purchase with the browser tab closed right after confirming.
