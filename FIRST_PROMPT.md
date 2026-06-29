# Pre-Build Checklist and First Prompt for Claude Code

---

## Before You Open Claude Code: Do These 4 Things

### 1. Install Claude Desktop (which includes Claude Code)
- Go to https://claude.ai/download
- Download and install Claude Desktop
- Open it and log in
- Claude Code is available inside Claude Desktop (look for the terminal/code icon)

### 2. Install Node.js (if not already installed)
- Go to https://nodejs.org
- Download Node.js 20 LTS (Long Term Support)
- Install it. Verify by running in your terminal: `node --version`
- You should see v20.x.x or higher

### 3. Create a project folder on your computer
```
mkdir poip-mvp
cd poip-mvp
```

### 4. Copy your three context files into the project folder
Copy these three files into the `poip-mvp` folder:
- `CLAUDE.md` (the master context file)
- `schema.prisma` (the database schema — will be moved into place by Claude Code)
- This file (for reference)

---

## Three Decisions You Need to Make Now

Answer these before starting Claude Code. Your answers go into the first prompt below.

**Decision 1: Project name**
Default: `poip-mvp` — change if you want something different.

**Decision 2: Currency pairs to support initially**
Suggested defaults (confirm or modify):
- KES/USD (Kenya Shilling to US Dollar)
- TZS/USD (Tanzania Shilling to US Dollar)
- RWF/USD (Rwanda Franc to US Dollar)
- UGX/USD (Uganda Shilling to US Dollar)
- ETB/USD (Ethiopia Birr to US Dollar)
- ZMW/USD (Zambia Kwacha to US Dollar)
- KES/EUR, KES/GBP, KES/AED
- USD/KES, USD/TZS (reverse legs)

**Decision 3: Slack webhook URL (optional for MVP)**
If you want real Slack notifications during the MVP demo:
- Go to your Slack workspace
- Create a channel called `#poip-alerts`
- Go to api.slack.com → Your Apps → Create an app → Incoming Webhooks
- Copy the webhook URL
- If you skip this, alerts will just print to console (fine for MVP)

---

## The First Prompt to Give Claude Code

Open Claude Desktop. Start Claude Code. Navigate to your project folder.
Then paste this exact prompt (edit the parts in [brackets]):

---

**PASTE THIS INTO CLAUDE CODE:**

```
Read CLAUDE.md completely before doing anything else.

I am building the Payments Onboarding and Intelligence Platform (POIP) described in CLAUDE.md.

We are starting from scratch. This is Step 1 of the build order.

Here is what I need you to do in this session:

1. Scaffold a new Next.js 14 project with TypeScript and Tailwind CSS in the current directory. Use the App Router. Use npm (not yarn or pnpm).

2. Install these dependencies:
   - @prisma/client and prisma (ORM)
   - @shadcn/ui (component library — init it after Next.js is set up)
   - recharts (for charts)
   - lucide-react (for icons)

3. Move the schema.prisma file I have provided into the prisma/ directory.

4. Create a .env.local file with:
   DATABASE_URL="file:./prisma/dev.db"
   DEMO_MODE="true"
   NEXT_PUBLIC_DEMO_MODE="true"
   [if I have a Slack webhook, add: SLACK_WEBHOOK_URL="your-webhook-url-here"]

5. Run `npx prisma migrate dev --name init` to create the database from schema.prisma.

6. Verify the migration succeeded by running `npx prisma studio` and checking that all tables exist with the correct columns.

7. Create the seed file at prisma/seed.ts using the seed data defined in CLAUDE.md (users, markets, partners, bank accounts, 5 test clients at different states, 30 trades for BlueSky Remittances).

8. Run the seed: `npx prisma db seed`

9. Tell me what you built, show me the table row counts from the seed, and ask me to confirm before moving to Step 2.

Do not build any UI yet. Do not add any routes yet. Only the database setup and seed.

After each file you create, tell me the file path so I can track what exists.
```

---

## After Step 1 is Confirmed Working

Once you verify the database is seeded correctly, start the next session with this:

```
Read CLAUDE.md. Check CURRENT STATUS.

We completed Step 1 (schema and seed). The database has:
- 6 users
- 5 test clients at different states
- 6 markets with partners
- 30 trades for BlueSky Remittances

Update CLAUDE.md: move Step 1 to Completed, mark Step 2 (state machine) as In Progress.

Now build Step 2: the state machine module at src/lib/stateMachine.ts.

Requirements:
- A transitions object mapping every valid state → array of states it can move to
- A validateTransition(fromState, toState) function that returns true/false
- A transitionClient(clientId, toState, actorId, triggeredBy, notes) async function that:
  1. Validates the transition is allowed
  2. Updates clients.currentState and clients.stateEnteredAt
  3. Writes a record to ClientStateLog
  4. Returns the updated client
  5. Throws a 400-equivalent error if the transition is invalid

Write unit tests for the state machine:
- Valid transition succeeds and writes log
- Invalid transition throws error
- Log record is always created on success

Do not build any API routes yet. Only the state machine module and its tests.
```

---

## Session Pattern (repeat for every step)

Every Claude Code session follows this pattern:

**Opening message**:
```
Read CLAUDE.md. We are on Step [X]. [Brief description of what was completed last time.]
Today's goal: Build Step [X+1] only — [name of step].
Do not touch anything outside the scope of Step [X+1].
```

**After each step is verified**:
```
Step [X] is working. Please update CURRENT STATUS in CLAUDE.md:
- Move Step [X] to Completed with today's date
- Mark Step [X+1] as In Progress
- Note any files created or changed
```

**If something breaks**:
```
[Describe what broke]. Do not try to fix it yet.
First, audit what exists: show me the current state of [file/route/table] 
and tell me what changed in the last session that could have caused this.
```

---

## What You Will Have After All 12 Steps

A running web app at `http://localhost:3000` with:

- **Dashboard** — live KPIs from the database, 4 analytics charts from real trade data
- **Onboarding Kanban** — all 5 test clients visible in their correct state columns, SLA timers showing elapsed time, advance-state button gated by role
- **Client Detail** — full state timeline, documents, compliance status, contract history, trade list
- **Trade Entry Form** — currency pair, direction, volume, rate, margin — generates idempotency key, rejects duplicates
- **Market Infrastructure** — all 6 markets with partner list, real flag logic (Tanzania: bank count warning, Uganda: payments not ready, Ethiopia: multiple flags)
- **Alert Log** — deduplication-keyed alerts, acknowledge toggle
- **Role Switcher** — switch between RM / Compliance / Legal / Admin / Treasury to see what each role can access

Total estimated build time with Claude Code: 4–6 focused sessions of 1–2 hours each.

---

## Common Claude Code Mistakes to Avoid

**Do not paste everything at once.** One step per session. Claude Code loses context on big sessions.

**Do not skip the verify step.** After each step, check it works before moving on. Fixing broken foundations is 3x slower than building them right.

**Do not let Claude Code rewrite files it has not been told to touch.** If it starts modifying files outside the current step, stop it: "You are only authorized to work on [specific file] today."

**Do not accept "I'll add that later" from Claude Code.** If a hard rule (idempotency, deduplication, state log completeness) is not implemented in the current step, it needs to be done now.

**Update CLAUDE.md after every session.** This is how Claude Code knows where you are. Without it, the next session starts blind.
