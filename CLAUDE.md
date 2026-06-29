# CLAUDE.md — Payments Onboarding and Intelligence Platform (POIP)

> This file is read by Claude Code at the start of every session.
> Update the CURRENT STATUS section after each session.
> Never delete completed items — move them to DONE.

---

## What We Are Building

A full-stack web application that replaces a fragmented manual workflow
(WhatsApp + email + Slack + HQ + DocuSign) with a structured platform for:
- Tracking client onboarding through a defined 22-state machine
- Capturing structured trade data with idempotency protection
- Managing market infrastructure across 6 African markets
- Generating analytics from real logged data (not mocked numbers)

This is a DEMO_MODE MVP. No real auth yet. Role switcher in UI.
External integrations (Samsub, DocuSign, WhatsApp, HQ) are mocked — the workflow logic is real.

---

## Tech Stack (do not change without asking)

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite via Prisma ORM (file: ./prisma/dev.db)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Email**: Resend (mocked in DEMO_MODE — just log to console)
- **Slack alerts**: Incoming webhook (log to console in DEMO_MODE)
- **State machine**: Custom FSM — no library, just a transitions map object
- **Scheduler**: setInterval in a background route handler (simple, not a job queue)

---

## Operating Mode

**Current mode: DEMO_MODE = true**

In DEMO_MODE:
- No real authentication
- A role switcher in the top nav allows switching between: RM, COMPLIANCE, LEGAL, ADMIN, TREASURY
- The active role is stored in a cookie: `demo_role`
- All API routes read `demo_role` from the cookie to determine permissions
- No email is actually sent — log to console with prefix [MOCK EMAIL]
- No Slack message is actually sent — log to console with prefix [MOCK SLACK]
- Samsub calls return a mock response after 2 seconds
- DocuSign calls return a mock envelope ID

Do NOT add real auth until explicitly told to. Do NOT remove the role switcher.

---

## Roles and Permissions

| Role | Can do |
|---|---|
| RM | Create clients, advance onboarding states, view all clients, log trades, manage WhatsApp group status |
| COMPLIANCE | Review compliance submissions, approve or flag issues, view compliance queue |
| LEGAL | Review contracts in legal queue, mark as reviewed |
| ADMIN | Everything + market infrastructure management + user management |
| TREASURY | View active clients, log trades, view rate dashboard |

---

## State Machine: All Valid States

```
LEAD_RECEIVED → PACK_SENT → DOCS_SUBMITTED → DOCS_PROCESSING
→ DOCS_EXCEPTION → DOCS_VALIDATED → HQ_PROFILE_CREATED
→ SAMSUB_SUBMITTED → SAMSUB_COMPLETE → COMPLIANCE_REVIEW
→ COMPLIANCE_EXCEPTION → COMPLIANCE_APPROVED → CONTRACT_DRAFT_REQUESTED
→ CONTRACT_SENT → CLIENT_REVIEWING_CONTRACT → CONTRACT_COMMENTS_RECEIVED
→ LEGAL_REVIEW → CONTRACT_REVISED_SENT → CONTRACT_ACCEPTED
→ SIGNATORIES_REQUESTED → DOCSIGN_PENDING → DOCSIGN_SIGNED
→ CONTRACT_UPLOADED_HQ → USERS_REQUESTED → USERS_CREATED
→ CLIENT_ACTIVE → FIRST_TRADE_PENDING → TRADING
```

**State transition rules** (enforce in the state machine module):
- Only defined transitions are allowed. Reject any other transition with a 400.
- Every transition writes a record to ClientStateLog.
- Store the state entry timestamp on the client record (stateEnteredAt).
- DOCS_EXCEPTION can loop back to DOCS_PROCESSING (client resubmits docs).
- COMPLIANCE_EXCEPTION can loop back to SAMSUB_SUBMITTED (docs re-uploaded).
- CONTRACT_COMMENTS_RECEIVED → LEGAL_REVIEW (legal reviews) → CONTRACT_REVISED_SENT → back to CLIENT_REVIEWING_CONTRACT if client still has comments.

---

## Database Schema (Prisma — source of truth)

See `prisma/schema.prisma`. The schema there overrides anything in this file.

Key constraints to never violate:
- `trades.idempotencyKey` is UNIQUE — second insert with same key must fail gracefully
- `alerts.deduplicationKey` is UNIQUE — check before firing any alert
- `clients.currentState` must always be a valid state from the list above
- `ClientStateLog` must have a record for every state change — no silent transitions

---

## SLA Definitions (hardcoded in src/lib/sla.ts)

| State | Max Hours | Escalation Role | Channel |
|---|---|---|---|
| DOCS_SUBMITTED | 4 | RM | SLACK |
| DOCS_PROCESSING | 2 | SYSTEM | SLACK |
| DOCS_EXCEPTION | 24 | RM | EMAIL |
| SAMSUB_SUBMITTED | 4 | SYSTEM | SLACK |
| COMPLIANCE_REVIEW | 48 | COMPLIANCE | SLACK |
| COMPLIANCE_EXCEPTION | 24 | RM | EMAIL |
| CONTRACT_SENT | 72 | RM | SLACK |
| LEGAL_REVIEW | 48 | LEGAL | SLACK |
| DOCSIGN_PENDING | 24 | RM | EMAIL |
| USERS_REQUESTED | 24 | SYSTEM | SLACK |

---

## Hard Rules (never violate, never patch around)

1. **Idempotency**: Every trade insert checks idempotencyKey uniqueness first. On duplicate, return success with status DUPLICATE_REJECTED — never throw an error to the user.

2. **Alert deduplication**: Before firing any alert, compute `SHA256(alertType + entityId + YYYY-MM-DD)`. Query alerts table for this key. If found, skip. If not found, fire and insert.

3. **State machine enforcement**: The state machine module is the ONLY place that changes `clients.currentState`. No route handler sets currentState directly.

4. **State log completeness**: Every call to the state machine transition function must write to ClientStateLog. No exceptions.

5. **No hardcoded analytics**: Charts must query from the trades table. If the table is empty, the chart shows empty — not zeros, not mock data.

6. **DEMO_MODE protection**: The role switcher and demo_role cookie logic must never be removed or bypassed until AUTH_ENABLED is explicitly set.

7. **No lorem ipsum**: All seed data uses realistic African payments business data.

---

## Seed Data

Run `npx prisma db seed` to populate:

**Users** (demo users — no real auth):
- Grace Wanjiku (RM, Nairobi)
- David Osei (RM, Accra)
- Nicole Achieng (Compliance Lead)
- Lauren Mutua (Legal)
- James Kariuki (Treasury)
- Admin User (ADMIN)

**Markets**:
- Kenya (LOCAL_REGISTRATION, payments_capable: true, 3 bank partners)
- Tanzania (PARTNERSHIP, payments_capable: true, 2 bank partners → triggers flag)
- Rwanda (LOCAL_REGISTRATION, payments_capable: true, 3 bank partners)
- Uganda (NON_RESIDENT_ACCOUNT, payments_capable: false → triggers flag)
- Ethiopia (PARTNERSHIP, payments_capable: false, 1 bank partner → triggers flags)
- Zambia (LOCAL_REGISTRATION, payments_capable: true, 3 bank partners)

**Partners** (sample per market):
- Kenya: Equity Bank (BANK, API ACTIVE), KCB (BANK, API ACTIVE), Co-op Bank (BANK, API ACTIVE), Safaricom (TELCO, API ACTIVE), Airtel Kenya (TELCO, API ACTIVE)
- Tanzania: CRDB (BANK, API ACTIVE), NMB (BANK, API ACTIVE), Vodacom (TELCO, API IN_PROGRESS)
- Rwanda: Bank of Kigali (BANK, API ACTIVE), BPR Atlas Mara (BANK, API ACTIVE), MTN Rwanda (TELCO, API ACTIVE)
- Uganda: Stanbic Uganda (BANK, API NONE), MTN Uganda (TELCO, API ACTIVE)
- Ethiopia: CBE (BANK, API IN_PROGRESS), Telebirr (TELCO, API NONE)
- Zambia: Zanaco (BANK, API ACTIVE), FNB Zambia (BANK, API ACTIVE), Airtel Money (TELCO, API ACTIVE)

**Test Clients** (one at each key stage):
- Acme Imports Ltd (CORPORATE, Kenya + Rwanda, Payments) — state: COMPLIANCE_REVIEW
- Savanna Trade Co (NON_FI, Tanzania + Uganda, OTC) — state: CONTRACT_SENT
- BlueSky Remittances (FI, Kenya + Zambia, Combined) — state: TRADING (with 30 seeded trades)
- Horizon Capital (FI, Ethiopia + Rwanda, OTC) — state: DOCS_EXCEPTION
- FastPay Solutions (CORPORATE, Kenya, Payments) — state: LEAD_RECEIVED

---

## Build Order (do not skip steps, do not reorder)

Track current step in CURRENT STATUS below.

1. **[SCHEMA]** → Apply Prisma schema. Run `npx prisma migrate dev`. Verify all tables created, foreign keys enforced, unique constraints active.

2. **[SEED]** → Run seed script. Verify: 5 clients in correct states, 6 markets, partners per market, 30 trades for BlueSky.

3. **[STATE MACHINE]** → Build `src/lib/stateMachine.ts`. Transitions map, validate function, transition function (writes to log). Verify: invalid transition returns 400, valid transition updates client + writes log.

4. **[SLA ENGINE]** → Build `src/lib/sla.ts` + `src/lib/alerts.ts`. SLA definitions object. Alert function with deduplication key check. Verify: alert fires once per client per day per state, not repeatedly.

5. **[API ROUTES]** → Build REST API: clients CRUD, documents, compliance, contracts, trades, markets, partners, alerts. Verify: all routes enforce role from demo_role cookie, invalid transitions return 400.

6. **[CRON]** → Background SLA monitor running every 15 minutes via `setInterval` in a route handler that is called once on startup. Verify: stalled clients get one alert per day, not multiple.

7. **[KANBAN UI]** → Onboarding tracker: one column per state group, client cards with SLA timer, advance state button (role-gated). Verify: advancing state writes to log, SLA timer shows correct elapsed time.

8. **[CLIENT DETAIL]** → Full client page: state timeline, documents list with status, compliance section, contract section, trade history. Verify: timeline shows every state transition with actor and timestamp.

9. **[TRADE FORM]** → Manual trade entry: client select, currency pair, direction, volume, rate, margin, bank account, date. Idempotency key generated from fields. Verify: submitting same trade twice shows DUPLICATE_REJECTED, not error.

10. **[ANALYTICS]** → Dashboard KPIs + 4 charts: volume by day of week, volume by day of month, margin by currency pair, revenue by client type. All from live trades table. Verify: empty DB shows empty charts with "No data yet" message.

11. **[MARKET INFRASTRUCTURE]** → Per-market page: setup type, partner list, bank count with flag if < 3, API status badges, LON status badges. Verify: Tanzania shows bank flag, Uganda shows payments flag, Ethiopia shows multiple flags.

12. **[ALERT LOG]** → List of all fired alerts: type, entity, severity, channel, acknowledged toggle. Verify: acknowledging an alert marks it as acknowledged without deleting it.

---

## File Structure

```
/
├── CLAUDE.md                    ← this file
├── prisma/
│   ├── schema.prisma            ← database schema (source of truth)
│   └── seed.ts                  ← seed data
├── src/
│   ├── app/
│   │   ├── layout.tsx           ← root layout with role switcher
│   │   ├── page.tsx             ← dashboard (KPIs + charts)
│   │   ├── clients/
│   │   │   ├── page.tsx         ← onboarding kanban
│   │   │   └── [id]/page.tsx   ← client detail
│   │   ├── trades/
│   │   │   └── page.tsx         ← trade log + form
│   │   ├── markets/
│   │   │   └── page.tsx         ← market infrastructure
│   │   ├── alerts/
│   │   │   └── page.tsx         ← alert log
│   │   └── api/
│   │       ├── clients/         ← client CRUD + state transitions
│   │       ├── documents/       ← document management
│   │       ├── compliance/      ← compliance review endpoints
│   │       ├── contracts/       ← contract management
│   │       ├── trades/          ← trade log + idempotency
│   │       ├── markets/         ← market infrastructure
│   │       ├── alerts/          ← alert management
│   │       └── cron/            ← SLA monitor (called once on startup)
│   ├── lib/
│   │   ├── stateMachine.ts      ← FSM: transitions, validate, transition
│   │   ├── sla.ts               ← SLA definitions and checker
│   │   ├── alerts.ts            ← alert fire + deduplication
│   │   ├── idempotency.ts       ← trade idempotency key generation
│   │   └── prisma.ts            ← Prisma client singleton
│   └── components/
│       ├── RoleSwitcher.tsx     ← DEMO_MODE role switcher
│       ├── StateBadge.tsx       ← colored state pill
│       ├── SLATimer.tsx         ← elapsed time display
│       └── MarketFlag.tsx       ← red/amber/green flag badge
└── .env.local                   ← DEMO_MODE=true, DATABASE_URL=file:./dev.db
```

---

## CURRENT STATUS

**Phase**: 1 — Foundation
**Layer**: Alert Log complete
**Last completed step**: Step 12 — Alert Log (attached roadmap Step 11)
**Next step**: Post-roadmap QA, UX polish, and handoff review

**What is working**:
- Prisma schema, migration, and seeded SQLite demo data.
- State machine validation and `transitionClient()` logging through `ClientStateLog`.
- SLA breach detection and same-day alert deduplication.
- JSON API routes for clients, client detail, transitions, trades, markets, alerts, and analytics.
- Background SLA monitor starts from `app/api/cron`, runs every 15 minutes, and uses alert deduplication.
- Root shell navigation, role switcher, state badges, SLA timers, and `/clients` Kanban UI.
- `/clients/[id]` client detail page with state timeline, documents, compliance, contracts, trade history, metadata, SLA timer, and role-gated state advance actions.
- `/trades` trade entry page with client selection, trade preview, recent trades table, and duplicate-trade idempotency messaging.
- `/` analytics dashboard with KPI cards and four charts sourced from `GET /api/analytics`: volume by weekday, volume by month day, margin by currency pair, and revenue by client type.
- `/markets` infrastructure page with per-market setup, partner lists, bank coverage flags, payments capability flags, API status badges, LON status badges, bank accounts, and ADMIN-only market settings edits.
- `/alerts` alert log with fired alert records, severity and channel badges, client links, acknowledgement status, and role-gated acknowledgement actions.
- Tests use an isolated `prisma/test.db` initialized from the checked-in migration SQL, avoiding Prisma CLI schema-engine calls.

**What must not break**:
- `transitionClient()` remains the only runtime writer of `clients.currentState`.
- Duplicate trades return HTTP 200 with `DUPLICATE_REJECTED`, not a user-facing error.
- Alerts deduplicate by type + entity + UTC date.
- Analytics are sourced from live trade rows and must not use hardcoded chart data.
- Role switcher must keep using `demo_role`; do not replace it with real auth until explicitly requested.

### Completed Steps
- 2026-06-29 — Step 1: Schema and migration verified.
- 2026-06-29 — Step 2: Seed data verified.
- 2026-06-29 — Step 3: State machine implemented in `src/lib/stateMachine.ts`; tests pass.
- 2026-06-29 — Step 4: SLA and alert modules implemented in `src/lib/sla.ts` and `src/lib/alerts.ts`; tests pass.
- 2026-06-29 — Step 5: API routes implemented under `app/api`; smoke checks pass for clients, transitions, trades, analytics, and markets.
- 2026-06-29 — Step 6: Background SLA monitor implemented in `app/api/cron/route.ts`; startup trigger added to `app/layout.tsx`; smoke check created 3 alerts and second cron call created no duplicates.
- 2026-06-29 — Step 7: Onboarding Kanban UI implemented with role switcher, root shell navigation, state badges, SLA timers, and state advance flow. Verification advanced Acme Imports Ltd from `COMPLIANCE_REVIEW` to `COMPLIANCE_APPROVED` and wrote a `ClientStateLog` entry.
- 2026-06-29 — Step 8: Client Detail Page implemented in `app/clients/[id]/page.tsx`; verification confirmed BlueSky Remittances has a full timeline and 30 trades, Horizon Capital shows a `DOCS_EXCEPTION` document reason, and Acme Imports Ltd shows the manual Step 6 transition by Nicole Achieng.
- 2026-06-29 — Step 9: Trade Form implemented in `app/trades/page.tsx`; verification logged one BlueSky Remittances `KES/USD` SELL trade, showed `DUPLICATE_REJECTED` for the identical second submission, and confirmed BlueSky trade history moved from 30 to 31 rows.
- 2026-06-29 — Step 10: Analytics dashboard implemented in `app/page.tsx`; verification confirmed `/` and `/api/analytics` return 200, the starter homepage copy is gone, KPI data is live, and all four chart sections return database-backed rows.
- 2026-06-29 — Step 11: Market Infrastructure page implemented in `app/markets/page.tsx`; verification confirmed `/markets` and `/api/markets` return 200, six markets load, Tanzania shows the bank coverage flag, Uganda shows the payments flag, Ethiopia shows multiple infrastructure flags, RM PATCH is forbidden, and ADMIN PATCH succeeds.
- 2026-06-29 — Step 12: Alert Log page implemented in `app/alerts/page.tsx`; verification confirmed `/alerts` and `/api/alerts` return 200 for RM, Treasury is forbidden, acknowledging an alert sets `acknowledgedAt`, and the alert row remains in the log.

### In Progress
- Post-roadmap QA, UX polish, and handoff review

### Blocked
- None.

---

## Session Start Instructions for Claude Code

At the start of each session:
1. Read this file completely
2. Check CURRENT STATUS to know where we are
3. Ask me to confirm the next step before writing any code
4. Build only the next step — do not skip ahead
5. After each step is verified, update CURRENT STATUS before ending the session

Do not build multiple steps in one session unless explicitly asked.
Do not change the tech stack without asking first.
Do not add dependencies without listing them and asking for approval.
