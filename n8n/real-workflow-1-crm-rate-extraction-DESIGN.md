# Workflow 1 - CRM Supplier Rate Extraction

This workflow connects the Airavat CRM supplier-rate upload to Gemini. It does
not write public rates directly. Its only output is a signed callback to the CRM,
where extraction results are validated, staged, reviewed, and published.

## Flow

```text
CRM PDF upload
  -> authenticated n8n webhook
  -> download 15-minute signed private PDF
  -> PDF signature and size preflight
  -> Gemini structured extraction
  -> authenticated CRM callback
  -> inactive database rows awaiting human review
```

## Import

1. Run `node build-real-workflow-1-crm-rate-extraction.mjs`.
2. Import `real-workflow-1-crm-rate-extraction.json` into n8n.
3. Create an **HTTP Header Auth** credential for the inbound Webhook:
   - Header: `Authorization`
   - Value: `Bearer <N8N_RATE_WEBHOOK_SECRET>`
4. Create an **HTTP Header Auth** credential for Gemini:
   - Header: `x-goog-api-key`
   - Value: your Google AI Studio API key
5. Create a separate **HTTP Header Auth** credential for the CRM callback:
   - Header: `Authorization`
   - Value: `Bearer <N8N_RATE_CALLBACK_SECRET>`
6. Select the three credentials in their corresponding nodes.
7. Activate the workflow and copy its production URL into the CRM environment
   variable `N8N_RATE_EXTRACTION_WEBHOOK_URL`.

The test webhook URL works only while manually listening in the n8n editor. Use
the production webhook URL after activation.

## Extraction Contract

Gemini must return one row for every unique combination of:

- hotel;
- printed validity range;
- room type;
- meal plan;
- occupancy;
- market;
- amount and currency;
- rate unit.

Different prices for the same room across different date ranges must remain
different rows. The prompt forbids merged ranges, averaged prices, markup,
currency conversion, and availability assumptions.

The document also includes a `pricing_basis` of `rack`, `net`, or `unknown`.
The CRM administrator must confirm this before publication even when Gemini
extracts a value.

## Failure Handling

- Download, PDF validation, Gemini HTTP, and JSON parsing failures are returned
  to the CRM as `status: error`.
- The CRM keeps the private source PDF and exposes a **Retry extraction** action.
- Successful extraction can still contain warnings or zero usable rows; those
  cases enter CRM review instead of publishing silently.
- n8n has no Supabase service key and cannot activate a price.

## Privacy

The PDF bucket is private. n8n receives a signed URL that expires after 15
minutes. Supplier PDFs and net prices are not returned by the public website
API. Review supplier confidentiality terms before using any Gemini tier whose
data-use terms are unsuitable for those contracts.
