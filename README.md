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

Start the dev server (port 3100 — 3000 is usually taken by the marketing site):

```bash
npm run dev -- -p 3100
```

Open http://localhost:3100.

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
| `npm run db:seed` | Load demo data (destructive: clears business rows) |
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

## Status

### Working now
Auth (credentials + optional Google/magic link) · 12-role RBAC · full database
schema · app shell with animated sidebar, ⌘K global search and notifications ·
dashboard with real aggregate queries and Recharts · full Clients CRUD (TanStack
Table, server-side pagination/sort/filter, bulk actions, CSV export, 7-tab detail
page) · client portal overview · audit logging · light/dark.

### Next phases
Billing + Stripe/Authorize.Net · payment and email automation chains · employee
portal · SEO/GBP/Ads/Social modules · AI tools · reporting exports · ticketing ·
the external integrations listed in `.env.example`.

Sidebar items marked **Soon** are routed and permission-gated but not yet built.

The Clients module is the reference pattern — new modules copy its shape:
`lib/validations/<x>.ts` → `lib/queries/<x>.ts` → `app/(app)/<x>/actions.ts` →
table + form components → page.

---

## Deploying

Target is Vercel. Swap `DATABASE_URL` for a hosted Postgres (Neon/Supabase),
set `AUTH_SECRET` and `AUTH_URL`, and add whichever optional keys you want live.
`npm run build` runs `prisma generate` automatically.
