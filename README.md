# Sensei

I built Sensei because splitting expenses on a trip always turns into a mess of screenshots and
"wait, who paid for dinner?" — and most of the apps that solve it want everyone to make an account
first. I wanted something I could share with a group in one tap: split the bill however we actually
split it, and **settle up in the fewest possible payments**.

Here's what it does:

- **No accounts.** You just pick a name on your device — that's it. No sign-up, no password.
- **Cloud-shared.** Start a trip, share the join code or link, and everyone's looking at the same
  numbers. It auto-refreshes every few seconds, so you don't have to keep pulling to refresh.
- **Splits that match real life.** Split an expense equally, by exact amounts, or by weighted
  shares/percentages. Made a mistake? Edit or delete it — deletes give you a few seconds to undo.
- **It does the math.** Sensei nets everyone out and tells you exactly who pays whom, in the fewest
  transfers possible.
- **Mark things paid.** Once someone actually pays you back, record it and the balances drop — so
  settled debt stops haunting the list.
- **Trip housekeeping.** Rename or delete a trip whenever you need to.

It's built with **Next.js (App Router) + Supabase** and deploys to **Vercel**.

## How it works

| Concept | Notes |
| --- | --- |
| Identity | Just a name saved on your device (`lib/identity.ts`). No login. |
| Access control | Every trip has a unique **join code** — that code is the only "key". |
| Data | Supabase Postgres, accessed **server-side only** via the service-role key. |
| Settlement | Net balances + a greedy minimum-transfer heuristic (`lib/settlement.ts`). |

### A note on the security model

I deliberately skipped end-user auth — it'd be overkill for a "friends on a trip" app. Every database
call goes through Next.js **Server Actions** (`app/actions.ts`) using the Supabase **service-role
key**, which never leaves the server. Row Level Security is on with **no public policies**, so the
public/anon key can't read anything directly. The per-trip join code is the thing that gates access.

> So: anyone with a trip's join code can view and edit that trip. That's the trade-off for being
> frictionless — please don't put anything sensitive in here.

## Running it locally

### 1. Spin up a Supabase project and load the schema

1. Make a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Grab your credentials from **Settings → API**:
   - Project URL → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Set up your environment

```bash
cp .env.local.example .env.local
# then drop your Supabase URL and service-role key into .env.local
```

### 3. Go

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the unit tests (the split + settlement math) |

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo.
3. Add the environment variables (Project → Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

   > Keep both **server-only** — don't prefix them with `NEXT_PUBLIC_`.
4. Deploy. Just make sure you've run `supabase/schema.sql` against whatever project those keys point at.

## How the code is laid out

```
app/
  page.tsx              Landing (create / join, set your name)
  trips/[id]/page.tsx   Trip dashboard (server) -> components/TripView
  j/[code]/page.tsx     Share-link join: /j/CODE -> redirects to the trip
  actions.ts            Server Actions (trips, members, expenses, payments)
lib/
  supabase/server.ts    Server-only Supabase client (service-role)
  data.ts               Server-side reads
  splits.ts             Per-expense owed amounts (equal / amount / share)
  settlement.ts         Balances + the minimum-transfer algorithm
  settlement.test.ts    Unit tests
  money.ts              Integer-cent helpers (so no float drift)
  identity.ts           Device name (localStorage)
components/             UI (Home, TripView, ExpenseForm, ui primitives)
supabase/schema.sql     Database schema
```

## Updating the schema

`supabase/schema.sql` is idempotent (`create table if not exists` throughout), so it's safe to just
re-run the whole file in the Supabase SQL editor. The **`settlements`** table (recorded payments) was
an additive migration — if you set up an earlier version of this, re-run the file to pick it up. Until
you do, the app degrades gracefully: payments just won't show up.

## Things I left out (on purpose, for now)

No login, no trip-leader role, no approval flow. Identity is still per-device (a name in
`localStorage`), which means anyone who opens a share link gets added to the trip, and renaming a
person creates a new member — a stable per-device id would fix that down the line. Multi-currency
conversion, categories, and receipts are all things I might add later. Live sync is currently just
lightweight polling (every ~8s while the tab's open); I could swap in Supabase Realtime eventually.
