# Airavat CRM — Internal Workspace

A private CRM for a small Kenyan tours & travel company: one workspace for
customers, enquiries, a drag-and-drop sales pipeline, a step-by-step quotation
builder, bookings & payments, a shared WhatsApp inbox, tasks and light reports.

Built with **Next.js (App Router) · TypeScript · Tailwind CSS 4 · React Hook
Form · Zod · Supabase (Postgres / Auth / Realtime / Storage) · Meta WhatsApp
Business Cloud API**.

> **Runs out of the box in demo mode** — no backend needed. It ships with an
> in-memory sample dataset so every screen and flow works immediately. Connect
> Supabase + WhatsApp to go live (see below).

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

You land on the sign-in screen. Pick a demo profile:

| Profile | Role |
| --- | --- |
| **Amina Wanjiru** | Founder / Administrator (sees financials + settings) |
| **Daniel Otieno** | Travel Consultant |
| **Grace Mwangi** | Travel Consultant |

Switch profile any time from the avatar menu (top-right). "Reset demo data"
there restores the sample dataset.

Other commands:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

---

## What's included

- **Login** — demo profile picker; production swaps in Supabase email auth.
- **Dashboard** — six metrics (each opens a filtered view), a prioritised
  *Needs attention* list, *My tasks today*, and *Recent enquiries*.
- **Pipeline** — drag-and-drop Kanban across 8 stages, with filters
  (consultant / service / month / waiting-on / overdue) and a Completed & Lost
  archive view.
- **Customers** — searchable list + a profile with 6 tabs (Overview, Trips &
  enquiries, Quotations, Messages, Documents, Notes).
- **Enquiry detail** — full fields, activity timeline, and actions: build
  quotation, WhatsApp, add task, add note, change stage, mark lost (with
  reason).
- **Quotation builder** — 5 steps (trip details → services → up to 3 options →
  review → send), live totals, deposit/balance, statuses, PDF/print, private
  share link, WhatsApp/email delivery, and **convert to booking**.
- **Bookings** — record with supplier references (Amadeus PNR, hotel, transport),
  financials (selling / cost / gross profit / paid / outstanding), status, and
  payment recording.
- **WhatsApp inbox** — three panels (conversations · thread · customer context),
  delivery ticks, quick replies, an AI-draft helper (staff must review before
  sending), conversation assignment, and one-click customer + enquiry creation
  from a new number.
- **Tasks** — grouped by Overdue / Today / Upcoming, mine vs all, with priority.
- **Reports** — conversion rate, quotation acceptance, confirmed value, gross
  profit, enquiries by source, lost reasons, outstanding balances, consultant
  workload; filter by consultant.
- **Settings** — company info, quotation defaults, staff access (admin-only edit).

Responsive throughout: the sidebar becomes a drawer, tables scroll, the pipeline
scrolls horizontally, and the WhatsApp inbox shows one pane at a time on mobile.

---

## Architecture

```text
app/
  login/                     Demo sign-in
  (app)/                     Authenticated workspace (shared shell)
    dashboard · pipeline · customers · customers/[id]
    enquiries/[id] · quotations · quotations/new · quotations/[id]
    bookings · bookings/[id] · whatsapp · tasks · reports · settings
  share/[token]/             Public read-only quotation view (no auth)
  api/
    auth/login · auth/logout   Demo session cookie
    whatsapp/webhook           Meta Cloud API webhook (GET verify + POST events)
components/  layout · ui · forms · quotation · entities
lib/
  types.ts       Domain models (mirror the SQL schema)
  seed.ts        In-memory demo dataset
  workspace.tsx  Client state store: selectors + all mutations (React context)
  schemas.ts     Zod validation      quotation.ts  Pricing math
  labels.ts      Enum → label/tone   format.ts     Money/date/relative time
  auth.ts        Demo session        supabase.ts   Production clients (stub)
middleware.ts    Route protection
supabase/
  migrations/0001_schema.sql   Tables + enums + triggers
  migrations/0002_rls.sql      Row Level Security policies
  seed.sql                     Demo rows for the live DB
```

**Data layer.** In demo mode all state lives in a client-side workspace store
(`lib/workspace.tsx`) seeded from `lib/seed.ts`. It exposes typed selectors and
every mutation (move stage, create customer/enquiry/quotation, convert to
booking, record payment, send message, …) so the whole app is interactive with
no backend. The types match the SQL schema 1:1, so moving to Supabase is a
matter of replacing the store's selectors/mutations with queries — pages don't
change. `NEXT_PUBLIC_DATA_MODE=supabase` is the intended switch.

---

## Going live with Supabase

1. Create a Supabase project.
2. Run the migrations (SQL editor or `supabase db push`):
   `supabase/migrations/0001_schema.sql`, then `0002_rls.sql`.
3. Create staff via **Auth → Users**, then insert matching rows into
   `public.users` (see the header of `supabase/seed.sql`). Set one to `admin`.
4. Optionally load `supabase/seed.sql` for sample business data.
5. Copy `.env.example` → `.env.local` and fill the Supabase values; set
   `NEXT_PUBLIC_DATA_MODE=supabase`.
6. RLS is on for every table: only active staff (`is_staff()`) can read/write
   business data; admins manage `users`. Tighten to per-consultant ownership by
   editing `0002_rls.sql`.

---

## WhatsApp integration (Meta Cloud API)

The webhook lives at **`/api/whatsapp/webhook`** and is structured for
production:

- **GET** handles Meta's verification handshake — it echoes `hub.challenge`
  when `hub.verify_token` matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **POST** receives message and status events, optionally verifies the
  `X-Hub-Signature-256` HMAC (when `WHATSAPP_APP_SECRET` is set), and returns
  `200` immediately so Meta doesn't retry.

To connect it:

1. In the **Meta App dashboard** create a WhatsApp app and get the
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, a permanent
   `WHATSAPP_ACCESS_TOKEN`, and your `WHATSAPP_APP_SECRET`.
2. Set a webhook callback URL of `https://YOUR_DOMAIN/api/whatsapp/webhook` and
   a verify token equal to `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Subscribe to
   `messages`.
3. Implement the `TODO(production)` markers in the route: on an incoming
   message, **save it to Supabase immediately**, broadcast via **Realtime** so
   the inbox updates live, and send an **instant template acknowledgement** —
   do not wait for AI. AI may *draft* replies, but staff must approve before
   any pricing/quotation/booking content is sent.
4. Respect the 24-hour customer-care window: outside it, only approved template
   messages may be sent (the inbox already surfaces this state).
5. Outbound sends and background jobs (auto follow-ups, reminders) can be routed
   through **n8n** via `N8N_WEBHOOK_URL` if desired.

The webhook is safe to deploy before the DB wiring exists — with no env set it
verifies and logs without touching data.

---

## Production placeholders

Replace before real use:

- **Company identity** — name, WhatsApp business number, support email,
  registration/licence (shown as `[…]` on **Settings**).
- **Staff** — create real Supabase Auth users; the three demo profiles are
  fictional.
- **All sample data** — the 10 customers, 8 enquiries, 3 quotations, 2 bookings,
  conversations and tasks are invented for the demo.
- **Env secrets** — Supabase keys, WhatsApp tokens, app secret, verify token
  (`.env.example`). Never commit real values; the service-role key is
  server-only.
- **Data mode** — flip `NEXT_PUBLIC_DATA_MODE` to `supabase` and implement the
  Supabase-backed selectors/mutations.
- **PDF generation** — "Generate PDF" currently uses the browser print dialog;
  wire a server-side PDF renderer for branded documents if required.
- **Document storage** — the Documents tab lists records; connect Supabase
  Storage with signed URLs for secure file access.
- **Reference numbering** — demo refs (ENQ-/QUO-/BKG-) are generated
  client-side; use a DB sequence in production.

---

## Test results

Verified locally (see the session log for commands):

- `npm install` — succeeds.
- `npm run lint` — passes, 0 warnings.
- `npm run typecheck` — passes.
- `npm run build` — production build succeeds; all routes compile.
- Authentication — sign-in sets the session cookie; middleware redirects
  unauthenticated users to `/login` and signed-in users away from it; sign-out
  clears the session.
- Dashboard loads with live metrics; each metric links to a filtered view.
- Pipeline drag-and-drop moves cards between stages and logs an activity.
- Customers and enquiries can be created (validated with Zod) and open their
  detail pages.
- A quotation can be built end-to-end and saved (draft or sent).
- An accepted quotation converts into a booking with computed totals; recording
  a payment updates the outstanding balance.
- WhatsApp webhook GET verification and POST event handling respond correctly.
- Mobile layouts: sidebar drawer, horizontal pipeline scroll, single-pane inbox.

---

## Pre-launch checklist

- [ ] Create the Supabase project; run `0001_schema.sql` + `0002_rls.sql`.
- [ ] Create staff in Supabase Auth; insert `public.users`; set an admin.
- [ ] Set all env vars; `NEXT_PUBLIC_DATA_MODE=supabase`.
- [ ] Implement Supabase-backed data access + Realtime inbox updates.
- [ ] Register and verify the WhatsApp webhook; subscribe to `messages`.
- [ ] Implement instant acknowledgement + AI-draft approval flow.
- [ ] Configure Supabase Storage for documents with signed URLs.
- [ ] Replace all placeholder company details on Settings.
- [ ] Review RLS policies against your real role model.
- [ ] Add server-side PDF generation for branded quotations.
- [ ] Confirm audit logging (`activity_logs`) captures required changes.
- [ ] Load-test the pipeline and inbox with realistic volumes.
```
