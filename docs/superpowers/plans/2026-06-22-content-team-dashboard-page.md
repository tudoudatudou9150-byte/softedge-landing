# Content Team Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, reviewable Chinese content team scheduling and capacity dashboard page without deployment or database integration.

**Architecture:** Create a standalone static app in `content-team-dashboard/` so the current root landing page remains untouched. The page uses sample in-memory data, renders capacity by content-unit counts, supports read/edit mode with a demo password, and persists demo edits to `localStorage` for preview only.

**Tech Stack:** Static HTML, CSS, and vanilla JavaScript served locally with a simple static server.

---

### Task 1: Create The Static Page Shell

**Files:**
- Create: `content-team-dashboard/index.html`

- [ ] **Step 1: Add the HTML document**

Create `content-team-dashboard/index.html` with a Chinese document shell, linked stylesheet, linked script, and semantic regions for header, capacity summary, member schedule, projects, requests, and edit dialogs.

- [ ] **Step 2: Verify the document loads**

Run a local static server from `content-team-dashboard/` and open the page. Expected: the browser shows the page title and empty dashboard regions without console errors.

### Task 2: Add Dashboard Styling

**Files:**
- Create: `content-team-dashboard/styles.css`

- [ ] **Step 1: Add responsive layout styles**

Create a quiet internal-tool visual system: neutral background, compact header, status cards, tables, form controls, tags, dialogs, and mobile stacking.

- [ ] **Step 2: Verify layout at desktop and mobile widths**

Open the page at desktop and mobile widths. Expected: sections remain readable, tables scroll horizontally where needed, and no text overlaps.

### Task 3: Add Data Model And Rendering

**Files:**
- Create: `content-team-dashboard/script.js`

- [ ] **Step 1: Add sample data and calculation helpers**

Add members, week settings, capacity events, projects, and requests. Implement calculation helpers for theoretical capacity, event deductions, scheduled content units, remaining units, and status labels.

- [ ] **Step 2: Render the dashboard**

Render the top status, capacity metrics, member schedule grid, project table, request table, and deduction rules from the sample data.

- [ ] **Step 3: Verify capacity math**

Open the page and confirm the displayed numbers follow: `成员数 × 工作日 × 每日标准条数 - 扣减 - 已排条数 = 剩余可接条数`.

### Task 4: Add Preview Editing

**Files:**
- Modify: `content-team-dashboard/index.html`
- Modify: `content-team-dashboard/script.js`
- Modify: `content-team-dashboard/styles.css`

- [ ] **Step 1: Add edit password flow**

Use demo password `content2026`. Read-only mode hides edit controls. Correct password enters edit mode; wrong password shows an inline error.

- [ ] **Step 2: Add practical edit controls**

Allow editing week settings, adding project rows, adding capacity deduction events, adding requests, and changing request status. Persist preview changes to `localStorage`.

- [ ] **Step 3: Verify edit behavior**

Expected: wrong password cannot edit, correct password reveals controls, changes update capacity totals immediately, and a browser refresh keeps preview edits.

### Task 5: Final Local Verification

**Files:**
- Verify: `content-team-dashboard/index.html`
- Verify: `content-team-dashboard/styles.css`
- Verify: `content-team-dashboard/script.js`

- [ ] **Step 1: Run static page smoke check**

Open the local URL in the browser. Expected: the dashboard loads, shows Chinese content, supports read-only review, and edit controls work with the demo password.

- [ ] **Step 2: Check git scope**

Run `git status --short`. Expected: only the new `content-team-dashboard/` page and this plan are related to the current task; older unrelated untracked files remain untouched.
