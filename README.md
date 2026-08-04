# The Local Rankers CRM

Agency operations platform for **Local Rankers LLC** — clients, projects, billing,
SEO/GBP/Ads reporting and a client portal in one place.

Built with Next.js 15 · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Prisma · PostgreSQL · Auth.js v5.

---

## Quick start

```bash
npm install
```

Then set your Postgres password in `.env` (the file is already created with a
generated `AUTH_SECRET`):

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/localrankers_crm?schema=public"
```

Create the schema and load demo data:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000. If port 3000 is already taken by another project,
use `npm run dev:3100` instead.

---

## Demo accounts

All seeded users share the password **`LocalRankers!2026`**.

| Email | Role | Sees |
|---|---|---|
| `tom@thelocalrankers.com` | Super Admin | Everything |
| `dana@thelocalrankers.com` | Agency Manager | All modules except system settings |
| `marcus@thelocalrankers.com` | Marketing Manager | Delivery + marketing, no finance |
| `priya@thelocalrankers.com` | SEO Team | SEO/GBP + assigned work |
| `alex@thelocalrankers.com` | Google Ads Team | Ads + assigned work |
| `jordan@thelocalrankers.com` | Social Media Team | Social/content |
| `sam@thelocalrankers.com` | Developer | Projects + tasks |
| `elena@thelocalrankers.com` | Designer | Projects + files |
| `riley@thelocalrankers.com` | Content Writer | Content + knowledge base |
| `nina@thelocalrankers.com` | Accountant | Billing only, no marketing data |
| `chris@thelocalrankers.com` | Read-only | Everything, read-only |
| `client1@example.com` | Client | Client portal, own data only |

Sign in as different roles to see the sidebar change — nav items the role cannot
reach are hidden, and direct URL access redirects.

---

## Brand

Colors are sampled directly from the official logo (`public/images/logo.png`):

| Token | Hex | Role |
|---|---|---|
| `brand-navy` | `#152A3A` | Sidebar, headings, dark surfaces |
| `brand-green` | `#86BD3E` | Primary — buttons, active nav, positive deltas |
| `brand-teal` | `#10AA99` | Secondary — links, chart series 2 |
| background | `#F8FAFC` | App canvas (light) |

Type: **Sora** (display) + **Inter** (UI/body). Radius 16px. Icons: Lucide.

Tokens live in `src/app/globals.css` as Tailwind v4 `@theme inline` + CSS custom
properties, with a full dark-mode set. There is no `tailwind.config.js`.

Assets in `public/images/`: `logo.png` (navy wordmark), `logo-dark.png` (white
wordmark for dark surfaces), `mark.png` (chart-arrow glyph for the collapsed
sidebar), `brand-hero-glow.png`, plus generated favicons.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Load demo data — **destructive, dev only**: clears business rows and inserts fake clients |
| `npm run db:bootstrap` | Create one Super Admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` — use this on production |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, re-seed |

---

## Architecture

```
prisma/
  schema.prisma      ~35 models · soft deletes · audit fields · indexes
  seed.ts            demo dataset
src/
  app/
    (auth)/          login · register · forgot-password · verify · mfa
    (app)/           internal CRM — staff roles only
    (portal)/        client portal — CLIENT role only
    api/             auth · search · notifications
  components/
    ui/              shadcn primitives
    layout/          Sidebar · Topbar · CommandPalette · NotificationBell
    dashboard/       KpiCard · charts
    clients/         table · form sheet
    portal/          portal nav + user menu
    brand/           BrandLogo
  lib/
    auth.ts          Auth.js (Node runtime — Prisma + bcrypt)
    auth.config.ts   edge-safe subset used by middleware
    rbac.ts          12 roles · permission matrix · can() / requirePermission()
    audit.ts         field-level diff logging
    prisma.ts        client singleton
    queries/         server-side data access
    validations/     Zod schemas
  middleware.ts      route-group + per-resource guards
```

### Security model

Route groups are the boundary:

- `(auth)` — public
- `(app)` — staff only; each first path segment maps to an RBAC resource
- `(portal)` — `CLIENT` only, scoped to their own `clientId`

Checks run in three places and must agree: `middleware.ts` blocks the route,
every server action re-checks with `requirePermission()` (middleware alone is
bypassable), and the sidebar hides what the role cannot reach.

`scopeToClient()` returns an unsatisfiable filter for a `CLIENT` with no
`clientId`, so a misconfigured account leaks nothing.

### Conventions

Every business model carries `createdAt` / `updatedAt` / `deletedAt` plus
`createdById` / `updatedById`. **All reads must filter `deletedAt: null`** — use
the exported `notDeleted` helper from `src/lib/prisma.ts`.

Deletes are soft, so history stays intact for reporting and audit.

---

## HR: attendance, sales and payroll

### How pay is calculated

| Rule | Behaviour |
|---|---|
| Working days | Mon–Fri in that month, minus company holidays. Recomputed monthly, so Aug 2026 = 21 days and Sep 2026 = 22 |
| Per-day rate | `base salary ÷ working days` |
| Absence | A working day with **no clock-in** deducts one day's pay. This includes days the employee simply never marked |
| Late | Clocking in after `shiftStart` is flagged and reported, but **never** deducts |
| Approved leave | Paid by default. Flip `deductApprovedLeave` in `src/lib/payroll.ts` to deduct it instead |
| Weekends | Never counted as absence, even with no record |
| Commission | Percent of the sale converted to payroll currency. Only **approved** sales count |

Rounding: the deduction is derived from the unrounded `salary × days ÷ workingDays`
ratio and clamped to the base salary. Rounding the per-day rate first and
multiplying back up overshoots — 50,000 ÷ 22 × 22 = 50,000.06 — which would
push a fully-absent month to negative pay.

### Worked example — Abdul Wadood

Cold Calling Agent, 09:00–18:00, PKR 50,000/month, 6% commission.
July 2026 has 23 weekdays; he was absent one day and closed $1,500 of approved
sales at 278.50 PKR/USD:

```
Working days               23
Present                    22  (2 late — not deducted)
Absent                      1

Base salary        PKR 50,000
Per working day    PKR  2,174     (50,000 ÷ 23)
Absence deduction  PKR -2,174

Approved sales          $1,500 @ 278.50
Commission @ 6%    PKR +25,065
─────────────────────────────────
NET PAY            PKR 72,891
```

Seed him with `npx tsx prisma/seed-abdul.ts` — it prints this breakdown so the
arithmetic can be checked by eye. Sign in as `abdul@thelocalrankers.com`.

### Two traps to avoid

**Never seed an edit form from a list row.** List queries select only the
columns their table renders. Seeding a form from one submits every omitted
field as `""`, silently wiping stored data. Edit forms fetch the full record
themselves — see `getClientForForm` and `loadInvoice`. This was a live bug that
blanked 12 client fields (address, socials, notes) on every save.

**Don't add `loading.tsx` to these routes.** A `loading.tsx` creates a Suspense
boundary that, in this app, never resolves on the client — the page streams
correctly from the server (verified: full HTML with all content) but the
fallback is never swapped out, leaving the route permanently blank. It cost a
long debugging session on the dashboard. If you want skeletons, render them
inside the page from a `useState` loading flag rather than via `loading.tsx`,
and verify the route actually paints before shipping.

Related: don't let a JS animation control whether content is visible. The page
wrapper previously used Framer Motion with `initial={{opacity:0}}`; when the
animation didn't run the whole page stayed invisible.

### Dates — important

`Attendance.date`, `Holiday.date` and the payslip period bounds are Postgres
`date` columns, which Prisma truncates to their **UTC** part. Building them from
local time silently shifts every record a day earlier east of UTC.

Always use the helpers in `src/lib/date-only.ts` (`todayDateOnly`, `dateOnly`,
`dateKey`, `formatDateOnly`) for these columns, and never call
`getDate()`/`getDay()` or `date-fns format()` on a value read from one.

---

## Status

### Working now
Auth (credentials + optional Google/magic link) · 12-role RBAC · full database
schema · app shell with animated sidebar, ⌘K global search and notifications ·
dashboard with real aggregate queries and Recharts · full Clients CRUD (TanStack
Table, server-side pagination/sort/filter, bulk actions, CSV export, 7-tab detail
page) · client portal overview · audit logging · light/dark ·
**HR: clock in/out attendance, employee management with salary and commission,
sales entry with FX conversion, and monthly payroll** ·
**Billing: invoices with line items (retainers + upsells), payment recording
with partial payments, and recurring packages driving MRR**.

### Next phases
Billing + Stripe/Authorize.Net · payment and email automation chains · employee
portal · SEO/GBP/Ads/Social modules · AI tools · reporting exports · ticketing ·
the external integrations listed in `.env.example`.

Sidebar items marked **Soon** are routed and permission-gated but not yet built.

The Clients module is the reference pattern — new modules copy its shape:
`lib/validations/<x>.ts` → `lib/queries/<x>.ts` → `app/(app)/<x>/actions.ts` →
table + form components → page.

---

## Deploying (Vercel)

### Environment variables

Required:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Hosted Postgres. Must be the **pooled** connection string — serverless opens a connection per invocation. Neon: the host containing `-pooler`. Supabase: port `6543` plus `?pgbouncer=true&connection_limit=1` |
| `AUTH_SECRET` | `npx auth secret`. Use a different value than local |
| `AUTH_URL` | e.g. `https://crm.thelocalrankers.com` — used to build password-reset links |

`AUTH_TRUST_HOST` is not needed; `trustHost: true` is set in `src/lib/auth.config.ts`.

Optional — each feature hides itself when its keys are absent:

| Variable | Enables |
|---|---|
| `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` | Google sign-in (needs both). Add `<AUTH_URL>/api/auth/callback/google` as an authorized redirect URI |
| `AUTH_RESEND_KEY` + `EMAIL_FROM` | Magic-link sign-in and outbound email |

Everything else in `.env.example` is Phase 2 scaffolding and currently unused.

### First deploy

`npm run build` runs `prisma generate`, but **not** migrations — build-time
migrations race across concurrent deploys. Apply them yourself, once, with
`DATABASE_URL` pointing at production:

```bash
npx prisma migrate deploy
```

Then create your login. A freshly migrated database has **zero users**, and
registration is invite-only, so without this step you are locked out:

```bash
npm run db:bootstrap
```

It prompts for the email and password (password input is hidden), or reads
`ADMIN_EMAIL` / `ADMIN_PASSWORD` if you prefer to set them. Do **not** run
`db:seed` against production — it wipes business tables and inserts fake clients.
