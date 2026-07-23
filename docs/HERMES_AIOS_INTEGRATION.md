# Hermes as the Airavat AIOS intelligence layer

Hermes connects to Airavat through a local Model Context Protocol (MCP) server.
The adapter gives Hermes a focused view of CRM operations while Supabase remains
the system of record.

## Tool surface

Read tools:

- `aios_health`
- `list_enquiries`
- `get_enquiry_brief`
- `list_tasks`
- `search_hotel_catalog`

Confirmed write tools:

- `create_follow_up_task`
- `record_enquiry_recommendation`

The adapter deliberately does not expose arbitrary SQL, customer messaging,
quotation sending, price mutation, payment actions, or booking actions.

## Local configuration

The server reads `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from `Airavat-CRM/.env.local`. Secrets are not
copied into Hermes configuration.

Run the server:

```powershell
npm run aios:mcp
```

Run the non-destructive integration test:

```powershell
npm run test:aios-mcp
```

Hermes is configured with an absolute Node command and script path so the
integration works even when Hermes starts from a different working directory.

## Operating policy

Hermes should retrieve an enquiry brief before recommending an action, label
assumptions clearly, and treat supplier rates as reference rates until
availability is confirmed. Any write requires the consultant to approve the
exact action first. Customer communication, pricing changes, quote sending,
payments, and bookings remain human-controlled.
