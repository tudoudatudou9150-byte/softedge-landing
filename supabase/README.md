# Nubohome Supabase Setup

This folder prepares the real account, address, order, logistics, and admin system.

## What Supabase Will Store

- Customer accounts through Supabase Auth.
- Customer profile and phone number in `profiles`.
- Shipping addresses in `addresses`.
- Paid PayPal orders in `orders`.
- Shipment timeline updates in `order_events`.
- Owner/admin permissions through `profiles.role = 'admin'`.

## Setup Steps

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Add the Project URL and anon public key to `supabase-config.js`.
5. Create your own owner account from the site.
6. In Supabase SQL Editor, set your profile `role` to `admin`.
7. Add service role and PayPal credentials to Vercel environment variables before enabling API checkout.

## Security Model

Row Level Security is enabled on all customer/order tables.

- Customers can read and update their own profile.
- Customers can manage their own addresses.
- Customers can read only their own orders and tracking events.
- Admin users can read all orders and update fulfillment and tracking fields.

## Current Frontend Behavior

`portal.js` already supports Supabase Auth, customer addresses, customer orders, tracking events, and owner order updates. If `supabase-config.js` does not include the anon public key yet, the pages fall back to preview data so the layout can still be reviewed locally.

PayPal confirmation is handled by `api/paypal-webhook.js` after PayPal REST credentials and the webhook ID are saved in Vercel.
