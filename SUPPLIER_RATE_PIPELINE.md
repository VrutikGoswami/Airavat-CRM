# Supplier Rate Pipeline

This pipeline turns a private supplier PDF into reviewed hotel-rate rows that
the Airavat website can query without exposing supplier documents or net costs.

## Flow

1. An authenticated CRM staff member uploads a PDF from **Supplier Rates**.
2. The CRM validates the file, stores it in the private
   `supplier-rate-documents` bucket, and creates a `rate_documents` record.
3. The CRM sends n8n a 15-minute signed download URL. The PDF itself is never
   placed in a public bucket.
4. n8n sends the PDF and strict JSON schema to Gemini, then posts the result to
   `/api/rates/extraction-callback` using a separate callback secret.
5. The callback validates the JSON and replaces the staged extraction in one
   database transaction. Every hotel, room, occupancy, and date range remains
   a separate inactive row.
6. Staff review rows in the CRM. An administrator confirms whether the PDF
   contains rack or net prices and publishes the accepted rows.
7. The public website queries only rows where `review_status = approved` and
   `active = true`. Net rates receive the configured public markup server-side.

AI extraction is staging, not approval. Uploading or extracting a document can
never make a price public by itself.

## Supabase Setup

Run all migrations in numeric order, including:

```text
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_website_enquiry_rpc.sql
supabase/migrations/0004_supplier_rate_pipeline.sql
```

Migration `0004` creates the private Storage bucket, rate tables, staff-only
RLS policies, atomic extraction RPC, and admin-only publish/reject RPCs.

Create each CRM staff member in Supabase Auth and add a matching active row in
`public.users`. At least one user needs the `admin` role to publish rates.

## CRM Environment

Configure these in the CRM deployment:

```dotenv
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRM_PUBLIC_URL=https://YOUR_CRM_DOMAIN
N8N_RATE_EXTRACTION_WEBHOOK_URL=https://YOUR_N8N_DOMAIN/webhook/...
N8N_RATE_WEBHOOK_SECRET=...
N8N_RATE_CALLBACK_SECRET=...
```

Keep the service-role key and both webhook secrets server-only. Use two
different random values for the two webhook directions.

## n8n Setup

Import `n8n-workflows/real-workflow-1-crm-rate-extraction.json`, then configure:

- The webhook Header Auth credential with `Authorization: Bearer
  <N8N_RATE_WEBHOOK_SECRET>`.
- The Gemini Header Auth credential with `x-goog-api-key: <GEMINI_API_KEY>`.
- The callback Header Auth credential with `Authorization: Bearer
  <N8N_RATE_CALLBACK_SECRET>`.

Activate the workflow and place its production webhook URL in
`N8N_RATE_EXTRACTION_WEBHOOK_URL`.

## Publication Rules

- New rows are `pending` and inactive.
- Rows with semantic validation errors cannot publish.
- Rejected rows remain inactive.
- Only an active CRM administrator can publish a document.
- Publishing requires an explicit `rack` or `net` price basis.
- Publishing retires older overlapping rows with the same hotel, market, room,
  meal plan, and occupancy. Non-overlapping date ranges remain independently
  available.
- Approved documents cannot be re-extracted or rejected.

## Website Setup

The website uses its own server-only Supabase service-role client because the
rate tables intentionally have no anonymous read policy. Configure the same
Supabase project in the website deployment. The public API returns computed
quotes, never raw database rows or the document's pricing basis.
