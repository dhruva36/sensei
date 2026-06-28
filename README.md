# Sensei

Split shared trip expenses with friends and **settle up in the fewest possible payments**.

- **No accounts.** Each device just sets a display name (stored in `localStorage`).
- **Cloud-shared.** Create a trip, share the join code/link, and everyone sees the same live data.
- **Flexible splits.** Split an expense equally, by exact custom amounts, or by weighted shares / percentages.
- **Minimum-transaction settlement.** A debt-simplification algorithm tells you exactly who pays whom, with the fewest transfers.

Built with **Next.js (App Router) + Supabase**, deployable to **Vercel**.

## How it works

| Concept | Notes |
| --- | --- |
| Identity | A username saved on the device (`lib/identity.ts`). No login. |
| Access control | Each trip has a unique **join code** — that code is the only "key". |
| Data | Supabase Postgres, accessed **server-side only** via the service-role key. |
| Settlement | Net balances + greedy min-transfer heuristic (`lib/settlement.ts`). |

### Security model

There is no end-user authentication. All database access goes through Next.js **Server Actions**
(`app/actions.ts`) using the Supabase **service-role key**, which stays on the server and is never
shipped to the browser. Row Level Security is enabled with **no public policies**, so the public/anon
key can read nothing directly. The per-trip join code is the capability that gates access.

> This is appropriate for a low-stakes "friends on a trip" app. Anyone with a trip's join code can
> view and edit that trip. Don't store sensitive data.

## Local development

### 1. Create a Supabase project & run the schema

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Grab your credentials from **Settings → API**:
   - Project URL → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configure environment

```bash
cp .env.local.example .env.local
# then edit .env.local with your Supabase URL and service-role key
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the unit tests (split + settlement logic) |

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo.
3. Add environment variables (Project → Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

   > Keep both **server-only** — do **not** prefix with `NEXT_PUBLIC_`.
4. Deploy. Make sure you've run `supabase/schema.sql` against the project the keys point to.

## Project layout

```
app/
  page.tsx              Landing (create / join, set username)
  trips/[id]/page.tsx   Trip dashboard (server) -> components/TripView
  j/[code]/page.tsx     Share-link join: /j/CODE -> redirects to the trip
  actions.ts            Server Actions (create/join trip, members, expenses)
lib/
  supabase/server.ts    Server-only Supabase client (service-role)
  data.ts               Server-side reads
  splits.ts             Per-expense owed amounts (equal / amount / share)
  settlement.ts         Balances + minimum-transfer algorithm
  settlement.test.ts    Unit tests
  money.ts              Integer-cent helpers (no float drift)
  identity.ts           Device username (localStorage)
components/             UI (Home, TripView, ExpenseForm, ui primitives)
supabase/schema.sql     Database schema
```

## Notes / not included (by design)

No login, no trip-leader role, no approval workflow. Multi-currency conversion, categories, and
receipts are possible future additions. Live sync currently relies on revalidation after each action
(refresh to pull others' latest changes); Supabase Realtime could be layered on later.
