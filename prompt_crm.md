# Master Implementation Prompt — Private CRM for a Tours & Travel Company

You are a senior product designer and full-stack engineer. Design and build a private CRM web application for a small tours and travel company based in Kenya.

The application will be used by the founder and a small team to manage customers, enquiries, WhatsApp conversations, quotations, bookings, payments and follow-ups.

This is an internal business application, not a public travel website.

Build a clean, focused first version. Do not add enterprise features that the company does not need.

## Product objective

Create one central workspace where staff can:

1. Receive enquiries from the website and WhatsApp.
2. View or create customer records.
3. Move enquiries through a clear sales and booking pipeline.
4. Build professional travel quotations.
5. Send quotations to customers.
6. Track customer responses and follow-ups.
7. Convert accepted quotations into bookings.
8. Track payments and outstanding balances.
9. View the customer's full travel and communication history.

The product must feel simple enough for a small business owner to understand immediately.

## Design inspiration

Use the following products only as broad UX references:

- TravelJoy for travel-specific trip stages, client records and "waiting on" status.
- Pipedrive for a simple drag-and-drop pipeline.
- Travefy for quotation and itinerary presentation.
- Modern editorial travel brands for restrained colours and typography.

Do not copy their branding, exact layouts, wording or proprietary features.

## Visual direction

Create a refined internal application with a warm East African travel identity.

Use:

- Warm ivory application background: #F7F4EE
- Deep forest sidebar: #183128
- Charcoal primary text: #17201C
- Muted secondary text: #6B746E
- Terracotta primary action: #C65A32
- Light border: #DDD8CE
- Success: #2F7D5A
- Warning: #B7791F
- Error: #B64747

Use one modern sans-serif typeface such as Inter or Geist.

The interface should be:

- Clean and professional.
- Dense enough for daily work but never cramped.
- Consistent across every page.
- Desktop-first but fully usable on tablets and phones.
- Fast to scan.
- Calm rather than colourful.

Use:

- 8px spacing system.
- 10–12px card radius.
- Thin borders.
- Very subtle shadows.
- Clear selected and hover states.
- Tabular numerals for financial values.
- Small destination thumbnails only where useful.

Avoid:

- Glassmorphism.
- Large gradients.
- Generic purple SaaS styling.
- Huge rounded cards.
- Decorative charts.
- Scenic image backgrounds inside operational screens.
- Excessive icons.
- Animations that slow down work.
- A different layout style on every page.

## User roles

Create two roles:

### Founder / Administrator

Can:

- View all customers, enquiries and bookings.
- View financial figures.
- Assign work to staff.
- Create and edit quotations.
- Manage staff access.
- Edit company settings and quotation templates.
- View reports.

### Travel Consultant

Can:

- View assigned enquiries and customers.
- Respond to WhatsApp conversations.
- Create and edit quotations.
- Update booking stages.
- Add tasks and notes.
- Record payments.

Do not build complex permission management in the first release.

## Main navigation

Use a fixed left sidebar on desktop and a compact drawer on mobile.

Navigation items:

1. Dashboard
2. Pipeline
3. Customers
4. Quotations
5. Bookings
6. WhatsApp
7. Tasks
8. Reports
9. Settings

Include a prominent "Create" button at the top of the sidebar.

The Create menu should contain:

- New enquiry
- New customer
- New quotation
- New task

Include a global search field for customers, trips, quotations, phone numbers and booking references.

## Dashboard

The dashboard should answer:

- What needs attention?
- Which customers are waiting?
- What work is due today?
- How is the business performing?

Show only these six summary metrics:

1. New enquiries
2. Quotations awaiting customer response
3. Follow-ups due today
4. Confirmed bookings this month
5. Outstanding customer balances
6. Gross profit this month

Each metric must open the relevant filtered view.

Below the metrics, include:

### Needs attention

A prioritised list showing:

- Overdue follow-ups.
- Unanswered WhatsApp messages.
- Quotations nearing expiry.
- Payments overdue.
- Trips departing soon without completed documents.

### My tasks today

Show task, customer, related trip, due time and priority.

### Recent enquiries

Show:

- Customer.
- Destination.
- Travel dates.
- Service.
- Assigned consultant.
- Stage.
- Last activity.

Do not add decorative graphs to the first dashboard.

## Enquiry and booking pipeline

Create a drag-and-drop Kanban pipeline.

Stages:

1. New enquiry
2. Details needed
3. Quotation in progress
4. Quotation sent
5. Awaiting customer
6. Payment pending
7. Booking in progress
8. Confirmed

Completed and Lost should be archived views rather than permanent visible columns.

Each pipeline card should show:

- Customer name.
- Destination.
- Travel dates.
- Number of travellers.
- Estimated quotation value.
- Assigned consultant.
- Next-action date.
- WhatsApp unread indicator.
- Who the process is waiting on.

Use a separate "Waiting on" field:

- Our team
- Customer
- Supplier
- No one

Allow filtering by:

- Consultant.
- Service type.
- Destination.
- Travel month.
- Waiting on.
- Overdue status.

Clicking a card should open the enquiry detail page.

## Customer record

Create one clean customer profile page.

Header:

- Customer name.
- WhatsApp number.
- Email.
- Customer type.
- Assigned consultant.
- Quick WhatsApp button.
- Create quotation button.

Tabs:

1. Overview
2. Trips and enquiries
3. Quotations
4. Messages
5. Documents
6. Notes

Overview should show only useful information:

- Contact details.
- Preferred communication method.
- Traveller preferences.
- Previous destinations.
- Active enquiry.
- Next action.
- Outstanding balance.
- Recent activity timeline.

Do not request or prominently display passport data in the initial CRM version.

## Enquiry detail page

Show:

- Customer.
- Service requested.
- Origin and destination.
- Travel dates.
- Traveller count.
- Budget.
- Requirements.
- Lead source.
- Assigned consultant.
- Pipeline stage.
- Waiting-on status.
- Next action.
- Internal notes.

The right side should contain a chronological activity timeline:

- Website form received.
- WhatsApp message.
- Call note.
- Quotation created.
- Quotation sent.
- Customer response.
- Payment recorded.
- Booking confirmed.

Include actions:

- Build quotation.
- Send WhatsApp message.
- Add task.
- Add internal note.
- Change stage.
- Mark lost.

When marking an enquiry lost, require a reason:

- Price.
- No response.
- Dates changed.
- Availability.
- Booked elsewhere.
- Duplicate.
- Other.

## Quotation builder

Create a focused step-by-step quotation builder.

### Step 1: Trip details

- Customer.
- Destination.
- Travel dates.
- Number of travellers.
- Currency.
- Quotation validity date.

### Step 2: Add services

Allow these quotation item types:

- Flight.
- Hotel or safari camp.
- Airport transfer.
- Private transport.
- Tour or activity.
- Travel insurance.
- Visa-assistance service.
- Service fee.
- Custom item.

Each item should support:

- Supplier or airline.
- Description.
- Dates.
- Quantity.
- Cost price.
- Markup.
- Selling price.
- Tax.
- Notes.
- Cancellation conditions.

### Step 3: Options

Allow up to three quotation options:

- Option A
- Option B
- Option C

Use this for different airlines, hotels, camps or package levels.

The customer should be able to compare the options clearly.

### Step 4: Review

Show:

- Included services.
- Exclusions.
- Total price.
- Deposit required.
- Balance due.
- Validity date.
- Terms.
- Consultant contact information.

### Step 5: Send

Allow:

- Generate PDF.
- Generate private share link.
- Send by email.
- Send by WhatsApp.
- Save as draft.

Quotation statuses:

- Draft
- Sent
- Viewed
- Accepted
- Declined
- Expired

Do not imply that quotation acceptance confirms supplier availability or ticket issuance.

## Booking record

When a quotation is accepted, allow it to be converted into a booking.

Store:

- Customer.
- Travellers.
- Destination.
- Travel dates.
- Services.
- Supplier references.
- Amadeus PNR.
- Hotel confirmation references.
- Transport confirmation.
- Total selling price.
- Total cost.
- Gross profit.
- Amount paid.
- Outstanding balance.
- Booking status.
- Assigned consultant.

Booking statuses:

- Awaiting payment
- Being confirmed
- Partially confirmed
- Fully confirmed
- Travel completed
- Cancelled

## WhatsApp inbox

Create a fast shared WhatsApp inbox.

Use a three-panel desktop layout:

### Left panel

Conversation list showing:

- Customer name or phone number.
- Latest message.
- Time.
- Unread count.
- Assigned consultant.
- Related enquiry stage.

### Centre panel

Conversation thread with:

- Incoming and outgoing messages.
- Delivery status.
- Timestamps.
- Attachments.
- Quick-reply templates.
- Message composer.

### Right panel

Customer context showing:

- Customer details.
- Active enquiry.
- Destination.
- Travel dates.
- Current stage.
- Last quotation.
- Next action.
- Create or link enquiry button.

WhatsApp requirements:

- Incoming messages arrive through Meta Cloud API webhooks.
- Save the message immediately.
- Update the inbox through Supabase Realtime.
- Send an instant acknowledgement when appropriate.
- Do not wait for AI before acknowledging the customer.
- Allow AI to draft replies, but require staff approval before sending quotations, prices or booking information.
- Allow conversations to be assigned to a staff member.
- Allow one-click creation of a customer and enquiry from a new number.
- Store message delivery and failure status.
- Provide reusable quick replies.
- Respect WhatsApp template and messaging-window requirements.

## Tasks

Tasks should be simple.

Task types:

- Follow-up call.
- Send quotation.
- Confirm supplier.
- Collect payment.
- Send documents.
- General task.

Each task stores:

- Title.
- Customer or trip.
- Assigned staff member.
- Due date and time.
- Priority.
- Completion status.

Display overdue tasks clearly without aggressive colours.

## Reports

Keep reporting minimal.

Include:

- Enquiries by source.
- Enquiry-to-booking conversion rate.
- Quotation acceptance rate.
- Confirmed booking value.
- Gross profit.
- Outstanding balances.
- Lost enquiry reasons.
- Consultant workload.

Allow filtering by date range and consultant.

Do not add dozens of charts.

## Technical stack

Use:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Supabase PostgreSQL.
- Supabase Authentication.
- Supabase Realtime.
- Supabase Storage.
- React Hook Form.
- Zod.
- Meta WhatsApp Business Cloud API.
- n8n only for background automations where useful.

Use Row Level Security so authenticated staff can only access authorised business data.

Create tables for:

- users
- customers
- enquiries
- quotations
- quotation_options
- quotation_items
- bookings
- payments
- tasks
- conversations
- messages
- documents
- activity_logs

Use a clear relational schema. Do not duplicate customer information across every table.

## Responsive behaviour

Desktop is the primary working environment.

On mobile:

- Convert the sidebar into a drawer.
- Convert wide tables into readable list rows.
- Show pipeline columns through horizontal scrolling.
- Change the WhatsApp inbox to one panel at a time.
- Keep primary actions within thumb reach.
- Do not remove important functionality.

## Security and reliability

Implement:

- Secure login.
- Role-based access.
- Row Level Security.
- Server-side validation.
- Audit logs for important changes.
- Secure file access.
- No API secrets in frontend code.
- Loading, empty and error states.
- Confirmation before destructive actions.
- Automatic timestamps and user attribution.

## Demonstration data

Create realistic but clearly fictional sample data for:

- Ten customers.
- Eight enquiries across different pipeline stages.
- Three quotations.
- Two confirmed bookings.
- Several WhatsApp conversations.
- Follow-up tasks.
- One Maasai Mara enquiry.
- One corporate flight enquiry.
- One family holiday enquiry.

Do not use lorem ipsum.

## Final deliverables

Provide:

1. A complete runnable CRM web application.
2. Login screen.
3. Dashboard.
4. Kanban pipeline.
5. Customer records.
6. Enquiry pages.
7. Quotation builder.
8. Booking records.
9. WhatsApp inbox interface.
10. Tasks.
11. Minimal reports.
12. Responsive layouts.
13. Supabase schema and migrations.
14. Seed data.
15. `.env.example`.
16. Setup README.
17. WhatsApp integration instructions.
18. List of production placeholders.
19. Test results.
20. Pre-launch checklist.

Before completion, verify:

- The app installs.
- Authentication works.
- The database migrations run.
- The dashboard loads.
- Pipeline drag-and-drop works.
- Customers and enquiries can be created.
- A quotation can be generated.
- A quotation converts into a booking.
- WhatsApp webhook handling is structured correctly.
- Mobile layouts work.
- The production build succeeds.
