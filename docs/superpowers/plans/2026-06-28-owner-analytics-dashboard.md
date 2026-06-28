# Owner Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private owner-only traffic statistics and translate the owner dashboard into Chinese.

**Architecture:** Record anonymous page views through a serverless API into Supabase, then expose aggregated totals through an admin-only API. The owner dashboard reads the aggregate endpoint with the logged-in Supabase session token and renders Chinese metric cards above the orders table.

**Tech Stack:** Static HTML/CSS/JS, Vercel Functions, Supabase Postgres/PostgREST.

---

### Task 1: Supabase Analytics Storage

**Files:**
- Modify: `supabase/schema.sql`

- [ ] Add `public.page_views` with anonymous visitor id, path, referrer, user agent, and timestamp.
- [ ] Add indexes for `created_at` and `visitor_id`.
- [ ] Enable RLS and do not add browser read policies; analytics are read only through the server API.

### Task 2: Server APIs

**Files:**
- Create: `api/track-view.js`
- Create: `api/owner-analytics.js`

- [ ] `track-view` accepts anonymous POST requests and stores one page view.
- [ ] `owner-analytics` verifies the Supabase JWT, checks the profile role is `admin`, and returns total views, last 24 hour views, today views, unique visitors, top pages, and recent referrers.
- [ ] If analytics storage is not installed yet, return a clear API error instead of breaking the owner page.

### Task 3: Frontend Tracking

**Files:**
- Create: `analytics.js`
- Modify: `index.html`
- Modify: account/order/tracking/support/login/register/address/payment pages

- [ ] Generate or reuse a random anonymous visitor id in localStorage.
- [ ] Send a small background POST to `/api/track-view` on page load.
- [ ] Do not show any customer-facing tracking text.

### Task 4: Chinese Owner Dashboard

**Files:**
- Modify: `owner-dashboard.html`
- Modify: `portal.js`
- Modify: `styles.css`

- [ ] Translate owner dashboard navigation, hero, actions, table labels, buttons, and empty/error states into Chinese.
- [ ] Add Chinese analytics metric cards above the order table.
- [ ] Keep the owner dashboard hidden from ordinary customer navigation as it already is.

### Task 5: Verification and Deployment

**Files:**
- Verify changed API files with `node --check`.
- Verify static page text and script references with `rg`.
- Deploy to Vercel after commit and push.
