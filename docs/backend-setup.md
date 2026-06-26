# Nubohome Backend Setup Checklist

This checklist connects the current Nubohome pages to real accounts, orders, PayPal payments, and logistics.

## 1. Supabase

Create a Supabase project and run:

```sql
-- paste supabase/schema.sql into Supabase SQL Editor
```

Then copy:

- Project URL
- anon public key
- service role key

The anon public key can be used by the browser. The service role key must only be saved in Vercel environment variables. Do not put it in frontend JavaScript.

The frontend switch lives in `supabase-config.js`:

```js
window.NUBOHOME_SUPABASE = {
  url: "https://clhvywakfixgftmqohuu.supabase.co",
  anonKey: "paste-public-anon-key-here",
  checkoutMode: "standard"
};
```

Use `checkoutMode: "standard"` until PayPal REST credentials and Vercel environment variables are ready. Change it to `"api"` when the backend checkout is configured.

## 2. Vercel Environment Variables

Add these variables in Vercel Project Settings:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
SITE_URL=https://www.nubohome.net
```

Use `PAYPAL_ENV=sandbox` while testing and `PAYPAL_ENV=live` for real payments.

## 3. PayPal Developer

Create a PayPal REST app and get:

- Client ID
- Client Secret

Create a webhook pointing to:

```text
https://www.nubohome.net/api/paypal-webhook
```

Subscribe to at least:

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`

Copy the PayPal webhook ID into `PAYPAL_WEBHOOK_ID`.

## 4. Current API Routes

- `POST /api/create-paypal-order`
  - Creates a local Supabase order.
  - Creates a PayPal Orders API checkout.
  - Returns the PayPal approval URL.

- `POST /api/paypal-webhook`
  - Verifies the PayPal webhook signature.
  - Marks matching Supabase orders as paid.
  - Adds an order event.

## 5. Owner Admin Access

After creating your owner account from `register.html`, mark it as admin in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-owner-email@example.com';
```

Only admin accounts can read all orders and update fulfillment/tracking in cloud mode.

## 6. Logistics

The admin page supports manual carrier and tracking number entry plus shipping CSV export.

Because the browser is already logged into YunExpress, the next practical integration can be:

1. Export paid orders from the admin dashboard as a YunExpress-ready CSV.
2. Upload/import those orders into YunExpress.
3. Paste tracking numbers back into Nubohome admin.

After you obtain YunExpress API credentials, this can become fully automatic.
