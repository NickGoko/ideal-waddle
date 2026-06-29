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
**Layer**: 2 — State machine
**Last completed step**: Step 1 — Schema and Prisma setup + Seed
**Next step**: STEP 3 — SLA engine

**What is working**: Database schema migrated, seed data loaded (6 users, 5 clients, 6 markets, 18 partners, 30 trades). State machine module and unit tests complete.
**What must not break**: Prisma schema, seed data, state machine transitions map.

### Completed Steps
- **Step 1 [SCHEMA + SEED]**: Prisma schema applied, `npx prisma migrate dev` succeeded, all tables created. Seed verified: 6 users, 5 clients at correct states, 6 markets, 18 partners, 9 bank accounts, 30 trades for BlueSky. Files: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`.
- **Step 2 [STATE MACHINE]**: `src/lib/stateMachine.ts` — transitions map, `validateTransition()`, `transitionClient()`. `src/lib/prisma.ts` — Prisma singleton. Unit tests in `src/lib/__tests__/stateMachine.test.ts`. All tests pass.

### In Progress
- Step 3: SLA engine

### Blocked
_(list anything waiting on external input)_

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
