-- =============================================================================
-- Airavat CRM — relational schema (Supabase / PostgreSQL)
-- Run in the Supabase SQL editor or via `supabase db push`.
-- Customer data lives only in `customers`; everything references it by id.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Enums -------------------------------------------------------------------
create type user_role         as enum ('admin', 'consultant');
create type customer_type     as enum ('individual', 'family', 'corporate', 'group');
create type contact_method    as enum ('whatsapp', 'phone', 'email');
create type service_type      as enum ('flights', 'hotel', 'safari', 'holiday-package', 'transport', 'corporate', 'group');
create type pipeline_stage    as enum ('new', 'details-needed', 'quotation-in-progress', 'quotation-sent', 'awaiting-customer', 'payment-pending', 'booking-in-progress', 'confirmed');
create type waiting_on        as enum ('team', 'customer', 'supplier', 'none');
create type lead_source       as enum ('website', 'whatsapp', 'phone', 'email', 'referral', 'walk-in');
create type enquiry_status    as enum ('open', 'completed', 'lost');
create type lost_reason       as enum ('price', 'no-response', 'dates-changed', 'availability', 'booked-elsewhere', 'duplicate', 'other');
create type currency_code     as enum ('KES', 'USD', 'EUR', 'GBP');
create type quotation_status  as enum ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired');
create type quotation_item_type as enum ('flight', 'hotel', 'transfer', 'transport', 'activity', 'insurance', 'visa', 'service-fee', 'custom');
create type booking_status    as enum ('awaiting-payment', 'being-confirmed', 'partially-confirmed', 'fully-confirmed', 'travel-completed', 'cancelled');
create type payment_method    as enum ('mpesa', 'bank-transfer', 'card', 'cash');
create type task_type         as enum ('follow-up-call', 'send-quotation', 'confirm-supplier', 'collect-payment', 'send-documents', 'general');
create type priority_level    as enum ('low', 'medium', 'high');
create type message_direction as enum ('in', 'out');
create type message_status    as enum ('received', 'sent', 'delivered', 'read', 'failed', 'pending');
create type document_kind     as enum ('quotation', 'invoice', 'voucher', 'ticket', 'other');

-- --- Users (staff) — mirrors auth.users --------------------------------------
create table users (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null,
  email         text not null unique,
  role          user_role not null default 'consultant',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- --- Customers ---------------------------------------------------------------
create table customers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  whatsapp               text not null,
  email                  text,
  type                   customer_type not null default 'individual',
  assigned_consultant_id uuid references users (id) on delete set null,
  preferred_contact      contact_method not null default 'whatsapp',
  preferences            text,
  previous_destinations  text[] not null default '{}',
  company                text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on customers (assigned_consultant_id);

-- --- Enquiries ---------------------------------------------------------------
create table enquiries (
  id                     uuid primary key default gen_random_uuid(),
  ref                    text not null unique,
  customer_id            uuid not null references customers (id) on delete cascade,
  service                service_type not null,
  origin                 text,
  destination            text not null,
  travel_start_date      date,
  travel_end_date        date,
  dates_flexible         boolean not null default false,
  adults                 int not null default 1,
  children               int not null default 0,
  infants                int not null default 0,
  budget                 text,
  requirements           text,
  lead_source            lead_source not null default 'website',
  assigned_consultant_id uuid references users (id) on delete set null,
  stage                  pipeline_stage not null default 'new',
  waiting_on             waiting_on not null default 'team',
  next_action_label      text,
  next_action_date       date,
  estimated_value        numeric(12,2) not null default 0,
  status                 enquiry_status not null default 'open',
  lost_reason            lost_reason,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on enquiries (customer_id);
create index on enquiries (assigned_consultant_id);
create index on enquiries (stage);

-- --- Quotations --------------------------------------------------------------
create table quotations (
  id                     uuid primary key default gen_random_uuid(),
  ref                    text not null unique,
  customer_id            uuid not null references customers (id) on delete cascade,
  enquiry_id             uuid references enquiries (id) on delete set null,
  destination            text not null,
  travel_start_date      date,
  travel_end_date        date,
  adults                 int not null default 1,
  children               int not null default 0,
  infants                int not null default 0,
  currency               currency_code not null default 'KES',
  valid_until            date,
  status                 quotation_status not null default 'draft',
  created_by_id          uuid references users (id) on delete set null,
  deposit_pct            int not null default 30,
  exclusions             text[] not null default '{}',
  terms                  text,
  selected_option_label  text,
  share_token            text unique,
  created_at             timestamptz not null default now(),
  sent_at                timestamptz,
  viewed_at              timestamptz
);
create index on quotations (customer_id);
create index on quotations (enquiry_id);

create table quotation_options (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references quotations (id) on delete cascade,
  label         text not null check (label in ('A','B','C')),
  name          text not null,
  note          text
);
create index on quotation_options (quotation_id);

create table quotation_items (
  id            uuid primary key default gen_random_uuid(),
  option_id     uuid not null references quotation_options (id) on delete cascade,
  type          quotation_item_type not null,
  supplier      text,
  description   text,
  start_date    date,
  end_date      date,
  quantity      int not null default 1,
  cost_price    numeric(12,2) not null default 0,
  markup_pct    numeric(6,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  tax_pct       numeric(6,2) not null default 0,
  notes         text,
  cancellation  text
);
create index on quotation_items (option_id);

-- --- Bookings + payments -----------------------------------------------------
create table bookings (
  id                     uuid primary key default gen_random_uuid(),
  ref                    text not null unique,
  customer_id            uuid not null references customers (id) on delete cascade,
  quotation_id           uuid references quotations (id) on delete set null,
  enquiry_id             uuid references enquiries (id) on delete set null,
  destination            text not null,
  travel_start_date      date,
  travel_end_date        date,
  adults                 int not null default 1,
  children               int not null default 0,
  infants                int not null default 0,
  services_summary       text[] not null default '{}',
  amadeus_pnr            text,
  hotel_refs             text,
  transport_ref          text,
  total_selling          numeric(12,2) not null default 0,
  total_cost             numeric(12,2) not null default 0,
  amount_paid            numeric(12,2) not null default 0,
  status                 booking_status not null default 'awaiting-payment',
  assigned_consultant_id uuid references users (id) on delete set null,
  created_at             timestamptz not null default now()
);
create index on bookings (customer_id);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references bookings (id) on delete cascade,
  amount         numeric(12,2) not null,
  method         payment_method not null,
  reference      text,
  received_at    timestamptz not null default now(),
  recorded_by_id uuid references users (id) on delete set null
);
create index on payments (booking_id);

-- --- Tasks -------------------------------------------------------------------
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  type           task_type not null default 'general',
  customer_id    uuid references customers (id) on delete cascade,
  enquiry_id     uuid references enquiries (id) on delete cascade,
  booking_id     uuid references bookings (id) on delete cascade,
  assigned_to_id uuid references users (id) on delete set null,
  due_at         timestamptz,
  priority       priority_level not null default 'medium',
  done           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index on tasks (assigned_to_id);
create index on tasks (due_at);

-- --- WhatsApp ----------------------------------------------------------------
create table conversations (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid references customers (id) on delete set null,
  phone                  text not null,
  display_name           text not null,
  assigned_consultant_id uuid references users (id) on delete set null,
  enquiry_id             uuid references enquiries (id) on delete set null,
  unread_count           int not null default 0,
  last_message_at        timestamptz not null default now(),
  window_expires_at      timestamptz
);
create index on conversations (customer_id);
create unique index on conversations (phone);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  wa_message_id   text,
  direction       message_direction not null,
  body            text,
  attachment_name text,
  is_template     boolean not null default false,
  status          message_status not null default 'received',
  author_id       uuid references users (id) on delete set null,
  at              timestamptz not null default now()
);
create index on messages (conversation_id);

-- --- Documents ---------------------------------------------------------------
create table documents (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           document_kind not null default 'other',
  customer_id    uuid references customers (id) on delete cascade,
  booking_id     uuid references bookings (id) on delete cascade,
  storage_path   text,
  uploaded_by_id uuid references users (id) on delete set null,
  uploaded_at    timestamptz not null default now()
);

-- --- Activity log (audit) ----------------------------------------------------
create table activity_logs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  summary      text not null,
  customer_id  uuid references customers (id) on delete cascade,
  enquiry_id   uuid references enquiries (id) on delete cascade,
  booking_id   uuid references bookings (id) on delete cascade,
  actor_id     uuid references users (id) on delete set null,
  at           timestamptz not null default now()
);
create index on activity_logs (customer_id);
create index on activity_logs (enquiry_id);

-- --- updated_at trigger ------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated  before update on customers  for each row execute function set_updated_at();
create trigger enquiries_updated   before update on enquiries  for each row execute function set_updated_at();
