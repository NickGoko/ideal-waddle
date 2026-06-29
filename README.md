# POIP — Payments Onboarding & Intelligence Platform

A full-stack web application that replaces a fragmented manual workflow
(WhatsApp + email + Slack + HQ + DocuSign) with a single structured platform for:

- Tracking client onboarding through a defined **22-state machine**
- Capturing structured **trade data** with idempotency protection
- Managing **market infrastructure** across 6 African markets
- Generating **analytics** from real logged data (never mocked numbers)

> **Demo MVP.** Runs in `DEMO_MODE`: no real authentication (a role switcher stands
> in for login), and external integrations (Sumsub, DocuSign, WhatsApp, HQ) are mocked.
> The *workflow logic* — state machine, idempotency, alert deduplication — is real.

---

## ⚠️ Project status

The 12-step DEMO_MODE MVP build is complete. The data layer, workflow foundation,
core API routes, cron monitor, onboarding UI, trade logging, analytics, market
infrastructure, and alert log are implemented.

| Layer | Status |
|---|---|
| Prisma schema (15 models) | ✅ Done — [`prisma/schema.prisma`](prisma/schema.prisma) |
| Initial migration | ✅ Done — [`prisma/migrations`](prisma/migrations) |
| Seed data (realistic, no lorem ipsum) | ✅ Done — [`prisma/seed.ts`](prisma/seed.ts) |
| State machine + transition logging | ✅ Done — [`src/lib/stateMachine.ts`](src/lib/stateMachine.ts) |
| SLA engine + alert deduplication | ✅ Done — [`src/lib/sla.ts`](src/lib/sla.ts), [`src/lib/alerts.ts`](src/lib/alerts.ts) |
| REST API routes | ✅ Done — [`app/api`](app/api) |
| Background SLA monitor | ✅ Done — [`app/api/cron`](app/api/cron) |
| Onboarding Kanban UI | ✅ Done — [`app/clients`](app/clients), [`components`](components) |
| Client detail page | ✅ Done — [`app/clients/[id]`](app/clients/%5Bid%5D) |
| Trade entry page | ✅ Done — [`app/trades`](app/trades) |
| Analytics dashboard | ✅ Done — [`app/page.tsx`](app/page.tsx) |
| Market infrastructure page | ✅ Done — [`app/markets`](app/markets) |
| Alert log page | ✅ Done — [`app/alerts`](app/alerts) |

**What this means for `npm run dev`:** the server boots fine, `http://localhost:3000`
shows the live analytics dashboard, and the sidebar links open working Clients,
Trades, Markets, and Alerts pages. You can also use **Prisma Studio** to browse the
seeded database (see [Reviewing the data](#reviewing-the-data)) or call the JSON API
routes under `/api`.

See the full [Roadmap](#roadmap) for what has been completed. The authoritative build
plan lives in [`CLAUDE.md`](CLAUDE.md).

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | SQLite via Prisma ORM |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | lucide-react |
| State machine | Custom FSM (a transitions map, no library) |

---

## Prerequisites

- **Node.js 20 LTS** or newer (`node --version` → `v20.x`+)
- **npm** (ships with Node)

---

## Quick start

From the project root (`ideal-waddle/`):

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file (see "Environment variables" below)
cp .env.example .env

# 3. Generate the Prisma client
npx prisma generate

# 4. Create the SQLite database and apply the migration
npx prisma migrate deploy

# 5. Seed realistic demo data
npx prisma db seed

# 6. Start the dev server
npm run dev
```

Then open **http://localhost:3000**.

> On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` in step 2.

### One-liner (after `npm install` and creating `.env`)

```bash
npx prisma migrate deploy && npx prisma db seed && npm run dev
```

---

## Reviewing the data

The UI covers the core workflows, and Prisma Studio remains useful when you want to
inspect the underlying seeded workflow data directly:

```bash
npx prisma studio
```

This opens **http://localhost:5555** with every table browsable. After seeding you'll find:

- **6 users** — RM, Compliance, Legal, Treasury, Admin
- **6 markets** — Kenya, Tanzania, Rwanda, Uganda, Ethiopia, Zambia
- **18 partners** + **9 bank accounts** (banks with active APIs)
- **5 clients**, each parked at a different onboarding state:

  | Client | Type | State |
  |---|---|---|
  | Acme Imports Ltd | CORPORATE | `COMPLIANCE_REVIEW` |
  | Savanna Trade Co | NON_FI | `CONTRACT_SENT` |
  | BlueSky Remittances | FI | `TRADING` (with 30 trades) |
  | Horizon Capital | FI | `DOCS_EXCEPTION` |
  | FastPay Solutions | CORPORATE | `LEAD_RECEIVED` |

- **30 trades** for BlueSky, plus a full `client_state_log` history per client,
  documents, compliance reviews, and contracts.

---

## Environment variables

Copy [`.env.example`](.env.example) to `.env`. Both the Prisma CLI and Next.js read this file.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path. `file:./dev.db` resolves to `prisma/dev.db` (relative to the schema). |
| `DEMO_MODE` | Enables demo behavior (server-side). |
| `NEXT_PUBLIC_DEMO_MODE` | Same flag, exposed to the browser. |
| `SLACK_WEBHOOK_URL` | *(optional)* Real Slack alerts. If unset, alerts log to the console. |

> **Note:** use `.env`, not `.env.local`. The Prisma CLI only auto-loads `.env`, while
> Next.js reads both — so `.env` is the single file both tools share. `.env` is gitignored.

---

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run state machine, SLA, and alert tests against an isolated SQLite test DB |
| `npx prisma studio` | Browse the database in a GUI |
| `npx prisma migrate deploy` | Apply existing migrations |
| `npx prisma migrate dev` | Create + apply a new migration after editing the schema |
| `npx prisma db seed` | (Re)seed demo data |

---

## Domain concepts

### Roles (DEMO_MODE)

A role switcher in the top nav sets a `demo_role` cookie; API routes read it
to determine permissions. No real auth.

| Role | Can do |
|---|---|
| **RM** | Create clients, advance onboarding, log trades, manage WhatsApp group status |
| **COMPLIANCE** | Review compliance submissions, approve or flag issues |
| **LEGAL** | Review contracts, mark as reviewed |
| **ADMIN** | Everything + market infrastructure + user management |
| **TREASURY** | View active clients, log trades, view rate dashboard |

### Onboarding state machine

Clients move through 22 states from `LEAD_RECEIVED` to `TRADING`. Only defined
transitions are allowed (anything else is rejected), every transition is recorded in
`client_state_log`, and some states can loop back (e.g. `DOCS_EXCEPTION → DOCS_PROCESSING`).
The full state list and transition rules are documented in [`CLAUDE.md`](CLAUDE.md).

### Hard rules (invariants the build must never violate)

- **Idempotency** — every trade insert checks `idempotencyKey` uniqueness first; a
  duplicate returns `DUPLICATE_REJECTED`, never an error.
- **Alert deduplication** — alerts are keyed by `SHA256(type + entityId + YYYY-MM-DD)`;
  fire at most once per entity per type per day.
- **State machine is the only writer** of `clients.currentState`, and every transition
  writes a log row.
- **No hardcoded analytics** — charts query the live `trades` table; empty data shows an
  empty state, not zeros.

---

## Project structure

```
ideal-waddle/
├── CLAUDE.md                 # Authoritative spec + build plan (read this first)
├── FIRST_PROMPT.md           # How the project was bootstrapped
├── prisma/
│   ├── schema.prisma         # Database schema — source of truth (15 models)
│   ├── seed.ts               # Realistic demo data
│   ├── migrations/           # SQL migration history
│   └── dev.db                # SQLite database (generated, gitignored)
├── app/
│   ├── api/                   # JSON API routes for clients, trades, markets, alerts, analytics
│   ├── clients/               # Onboarding Kanban and client detail pages
│   ├── trades/                # Manual trade entry and recent trade table
│   ├── markets/               # Market infrastructure dashboard
│   ├── alerts/                # Fired alert log and acknowledgement UI
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Analytics dashboard
│   └── globals.css
├── src/
│   └── lib/                  # Prisma singleton, auth helpers, FSM, SLA, alerts, tests
├── .env.example              # Template for your local .env
├── next.config.mjs
└── tailwind.config.ts
```

> The build plan in `CLAUDE.md` references a `src/` directory; the current scaffold
> uses the App Router at the repo root (`app/`). UI work will follow the existing
> `app/` layout.

---

## Roadmap

The build is sequenced in 12 steps (full detail in [`CLAUDE.md`](CLAUDE.md)):

1. ✅ **Schema** — Prisma models + migration
2. ✅ **Seed** — users, markets, partners, clients, trades
3. ✅ **State machine** — `transitions` map, `validate`, `transition` (+ tests)
4. ✅ **SLA engine** — SLA definitions + alert deduplication
5. ✅ **API routes** — clients, trades, markets, alerts, analytics
6. ✅ **Cron** — background SLA monitor (one alert per client per day)
7. ✅ **Kanban UI** — onboarding tracker with SLA timers, role-gated state advance
8. ✅ **Client detail** — state timeline, documents, compliance, contracts, trades
9. ✅ **Trade form** — manual entry with idempotency-key generation
10. ✅ **Analytics** — dashboard KPIs + 4 charts from live trade data
11. ✅ **Market infrastructure** — per-market view with flag logic
12. ✅ **Alert log** — fired alerts with acknowledge toggle

---

## Notes

- This is a `DEMO_MODE` MVP — **do not** add real auth or remove the role switcher
  until explicitly told to.
- Don't change the tech stack or add dependencies without confirming first.
- `prisma/dev.db` and `.env` are intentionally gitignored — recreate them locally with
  the Quick start steps above.
