# Design: Deploy ideal-waddle on Vercel via Turso (libSQL)

**Date:** 2026-06-29
**Status:** Approved (design); pending implementation plan
**Author:** POIP / ideal-waddle

## Problem

The app (Next.js 14 App Router + Prisma 5.22) uses a file-based SQLite database
(`provider = "sqlite"`, `url = file:./prisma/dev.db`). This works locally but
**cannot run on Vercel**:

1. Vercel serverless functions get a **read-only, ephemeral** filesystem (except
   `/tmp`). A file-based SQLite DB can't be written and doesn't persist between
   invocations.
2. `prisma/dev.db` is **gitignored**, so it isn't even part of the deployment.
3. `package.json` has **no `prisma generate`** in install/build, so on Vercel the
   generated `@prisma/client` is stale/missing — the classic Prisma-on-Vercel
   build failure.
4. `.env` (holding `DATABASE_URL`) is gitignored, so Vercel has no connection
   string unless it is set as a project environment variable.

A separate, already-resolved local issue (`Cannot find module './682.js'`) was a
stale `.next` cache mixing `next build` and `next dev` artifacts plus a running
dev server holding the Prisma engine DLL locked. Fixed by clearing `.next`,
stopping the stale dev server, and regenerating the Prisma client. That issue is
**out of scope** for this design and recorded here only for context.

## Goal

Make the app deployable and functional on Vercel **with the smallest change**,
keeping the SQLite dialect, while leaving local development untouched.

## Decisions

- **Database (prod):** Turso (libSQL) — SQLite-compatible, serverless-friendly,
  free tier. Chosen over Postgres to avoid a `sqlite -> postgresql` provider
  migration and re-authoring of migrations.
- **Local development:** unchanged — keeps `DATABASE_URL=file:./prisma/dev.db`,
  plain `PrismaClient`, already seeded, fully offline.
- **Switch mechanism:** environment-driven. The Prisma singleton uses the libSQL
  driver adapter **only when `DATABASE_AUTH_TOKEN` is present** (i.e. on Vercel);
  otherwise it constructs a plain `PrismaClient` (local). One code path.
- **Prisma version:** stay on Prisma 5.22 (no ORM upgrade). `driverAdapters` is a
  *preview* feature in 5.x; the adapter is pinned to `^5.22.0` to match the ORM.
  This honors the project's "do not change the tech stack without asking" rule.
- **Serverless cron:** the `setInterval`-based SLA monitor (started from
  `app/layout.tsx`) will **not** run on Vercel (ephemeral functions). Accepted as
  a known limitation, **out of scope** for this work. Future fix: a Vercel Cron
  Job hitting `/api/cron`.

## Architecture / Data Flow

```
                       local dev                      Vercel (prod/preview)
                  ----------------------         ------------------------------
DATABASE_URL      file:./prisma/dev.db           libsql://<db>.turso.io
DATABASE_AUTH_TOKEN   (unset)                     ey... (Turso token)

src/lib/prisma.ts:
  authToken present?  --no-->  new PrismaClient()                 (file SQLite)
                      --yes-->  new PrismaClient({ adapter:        (Turso libSQL)
                                  new PrismaLibSQL(
                                    createClient({ url, authToken })) })
```

No route handler, query, state machine, SLA, alert, or analytics code changes.
The data layer swap is isolated entirely to `src/lib/prisma.ts` plus the schema
generator flag.

## Changes

### 1. `prisma/schema.prisma`
Enable the preview feature on the generator (one line added):

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```
`datasource db` is unchanged (`provider = "sqlite"`).

### 2. `src/lib/prisma.ts`
Branch on `DATABASE_AUTH_TOKEN`, preserving the existing hot-reload singleton
guard on `globalThis`:

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (authToken && url) {
    const adapter = new PrismaLibSQL(createClient({ url, authToken }))
    return new PrismaClient({ adapter })
  }
  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### 3. `package.json`
- Add `"postinstall": "prisma generate"` — ensures the client is generated on
  Vercel installs.
- Add `"engines": { "node": "22.x" }` — pins Vercel to Node 22 LTS (the local
  machine's Node 25 is non-LTS and unsupported by Next 14 / Vercel).

### 4. New dependencies (approved)
- `@prisma/adapter-libsql@^5.22.0` — matches Prisma 5.22.
- `@libsql/client@^0.8.1` — libSQL driver. (Adapter 5.22 peer-requires `@libsql/client` <= 0.8.x; 0.14 is incompatible.)

## One-time Setup (operator-run)

1. Install Turso CLI; `turso auth signup` (browser login).
2. `turso db create ideal-waddle`.
3. Seed Turso once:
   - Apply checked-in migration SQL: `turso db shell ideal-waddle < prisma/migrations/20260629094118_init/migration.sql`.
   - Seed data: run the seed script against the Turso URL + token (env-injected
     so the adapter path is used).
4. `turso db show ideal-waddle --url` and `turso db tokens create ideal-waddle`
   to obtain `DATABASE_URL` (`libsql://...`) and `DATABASE_AUTH_TOKEN`.
5. Set both as Vercel environment variables (Production + Preview scopes).

## Out of Scope

- Migrating to Postgres.
- Running the SLA `setInterval` cron on serverless (future: Vercel Cron Job).
- Real authentication (project remains DEMO_MODE).
- Any change to routes, schema models, state machine, SLA, alerts, analytics.

## Testing / Verification

- **Local regression:** `npm run dev` serves HTTP 200 on `/`, `/clients`,
  `/api/analytics` against the file DB; pages render seeded content (not an error
  overlay). Confirms the env branch leaves local untouched.
- **Build:** `npm run build` succeeds (with `prisma generate` running).
- **Prod path:** with Turso env vars set, the Vercel deployment reaches its live
  URL; `/` and `/clients` render data served from Turso.

## Risks

- **Preview feature drift:** `driverAdapters` is preview in 5.x; pinning the
  adapter to 5.22 mitigates API mismatch. If 5.22 adapter API differs at
  implementation time, verify against installed version before coding.
- **Seed/migration on Turso:** Turso does not support `prisma migrate dev`
  (no shadow DB). Mitigation: apply the existing migration SQL directly via
  `turso db shell`, then seed.
