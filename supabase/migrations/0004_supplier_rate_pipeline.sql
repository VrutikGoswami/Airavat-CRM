-- =============================================================================
-- Supplier hotel-rate ingestion and publishing pipeline.
--
-- Security invariants:
--   * Supplier PDFs are stored in a private bucket.
--   * Extracted rates start inactive and pending review.
--   * Only an authenticated active administrator can publish or reject a file.
--   * No anonymous role can read supplier documents or raw/net rates.
-- =============================================================================

do $$ begin
  create type rate_document_status as enum (
    'uploaded', 'queued', 'extracting', 'review', 'approved', 'rejected', 'error'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type rate_review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type rate_pricing_basis as enum ('unknown', 'rack', 'net');
exception when duplicate_object then null;
end $$;

-- Keep this migration safe on CRM projects that were created before the RLS
-- helper migration was introduced. These definitions match 0001/0002 and are
-- intentionally schema-qualified so Storage policies can resolve them too.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.active = true
  );
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

create table if not exists rate_documents (
  id                    uuid primary key default gen_random_uuid(),
  file_name             text not null,
  storage_bucket        text not null default 'supplier-rate-documents',
  storage_path          text not null unique,
  mime_type             text not null check (mime_type = 'application/pdf'),
  file_size_bytes       bigint not null check (file_size_bytes > 0 and file_size_bytes <= 18874368),
  content_sha256        text not null unique check (content_sha256 ~ '^[0-9a-f]{64}$'),
  supplier_name         text,
  contract_name         text,
  document_type         text,
  pricing_basis         rate_pricing_basis not null default 'unknown',
  default_market        text,
  default_currency      text,
  status                rate_document_status not null default 'uploaded',
  extraction_model      text,
  hotel_count           int not null default 0,
  valid_rate_rows       int not null default 0,
  invalid_rate_rows     int not null default 0,
  warnings              jsonb not null default '[]'::jsonb,
  summary               text,
  ai_confidence         text,
  extraction_payload    jsonb,
  error_message         text,
  uploaded_by           uuid references users (id) on delete set null,
  reviewed_by           uuid references users (id) on delete set null,
  uploaded_at           timestamptz not null default now(),
  extraction_started_at timestamptz,
  extracted_at          timestamptz,
  reviewed_at           timestamptz,
  approved_at           timestamptz,
  updated_at            timestamptz not null default now()
);

create index if not exists rate_documents_status_idx
  on rate_documents (status, uploaded_at desc);

create table if not exists rate_hotels (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name             text not null,
  destination_slug text not null check (destination_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  destination_name text not null,
  city             text,
  country          text,
  star_rating      numeric(2,1),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists rate_hotels_destination_idx
  on rate_hotels (destination_slug, active);

create table if not exists hotel_rate_rows (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references rate_documents (id) on delete cascade,
  hotel_id              uuid not null references rate_hotels (id) on delete cascade,
  extraction_key        text not null,
  rate_type             text not null,
  season_name           text,
  valid_from            date not null,
  valid_to              date not null check (valid_to >= valid_from),
  booking_by            date,
  blackout_dates        text[] not null default '{}',
  room_type             text not null,
  meal_plan             text not null,
  occupancy             text not null,
  adults                int check (adults is null or adults >= 0),
  children              int check (children is null or children >= 0),
  amount                numeric(14,2) not null check (amount > 0),
  currency              text not null check (currency ~ '^[A-Z]{3}$'),
  market                text not null,
  unit_basis            text not null,
  minimum_stay          int check (minimum_stay is null or minimum_stay > 0),
  tax_included          text not null default 'Unknown' check (tax_included in ('Yes', 'No', 'Unknown')),
  commission_included   text not null default 'Unknown' check (commission_included in ('Yes', 'No', 'Unknown')),
  child_policy          text,
  cancellation_policy   text,
  payment_terms         text,
  conditions            text,
  source_page           int check (source_page is null or source_page > 0),
  ai_confidence         text not null default 'Low' check (ai_confidence in ('High', 'Medium', 'Low')),
  validation_errors     text[] not null default '{}',
  review_status         rate_review_status not null default 'pending',
  active                boolean not null default false,
  approved_by           uuid references users (id) on delete set null,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (document_id, extraction_key)
);

create index if not exists hotel_rate_rows_lookup_idx
  on hotel_rate_rows (hotel_id, market, valid_from, valid_to)
  where active = true and review_status = 'approved';
create index if not exists hotel_rate_rows_document_idx
  on hotel_rate_rows (document_id, review_status);

drop trigger if exists rate_documents_updated on rate_documents;
create trigger rate_documents_updated
  before update on rate_documents
  for each row execute function public.set_updated_at();

drop trigger if exists rate_hotels_updated on rate_hotels;
create trigger rate_hotels_updated
  before update on rate_hotels
  for each row execute function public.set_updated_at();

drop trigger if exists hotel_rate_rows_updated on hotel_rate_rows;
create trigger hotel_rate_rows_updated
  before update on hotel_rate_rows
  for each row execute function public.set_updated_at();

-- Private supplier-document bucket. The application service role performs the
-- upload; staff can download a source PDF for review through authenticated RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-rate-documents',
  'supplier-rate-documents',
  false,
  18874368,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table rate_documents enable row level security;
alter table rate_hotels enable row level security;
alter table hotel_rate_rows enable row level security;

drop policy if exists rate_documents_staff_all on rate_documents;
create policy rate_documents_staff_all on rate_documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists rate_hotels_staff_all on rate_hotels;
create policy rate_hotels_staff_all on rate_hotels
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists hotel_rate_rows_staff_all on hotel_rate_rows;
create policy hotel_rate_rows_staff_all on hotel_rate_rows
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists supplier_rate_documents_staff_read on storage.objects;
create policy supplier_rate_documents_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'supplier-rate-documents' and public.is_staff());

-- Atomically replace an extraction attempt. Only the server-side service role
-- receives EXECUTE; n8n calls the CRM callback rather than writing tables.
create or replace function replace_rate_extraction(
  p_document_id uuid,
  p_document jsonb,
  p_hotels jsonb,
  p_rows jsonb,
  p_warnings jsonb,
  p_model text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status rate_document_status;
  v_hotel jsonb;
  v_row jsonb;
  v_hotel_id uuid;
begin
  select status into v_status
  from rate_documents
  where id = p_document_id
  for update;

  if v_status is null then
    raise exception 'Unknown rate document %', p_document_id;
  end if;
  if v_status = 'approved' then
    raise exception 'Approved rate documents cannot be re-extracted';
  end if;
  if jsonb_typeof(p_hotels) <> 'array' or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Hotels and rows must be JSON arrays';
  end if;

  delete from hotel_rate_rows where document_id = p_document_id;

  for v_hotel in select value from jsonb_array_elements(p_hotels)
  loop
    insert into rate_hotels (
      slug, name, destination_slug, destination_name, city, country, star_rating
    ) values (
      v_hotel->>'slug',
      v_hotel->>'name',
      v_hotel->>'destination_slug',
      v_hotel->>'destination_name',
      nullif(v_hotel->>'city', ''),
      nullif(v_hotel->>'country', ''),
      nullif(v_hotel->>'star_rating', '')::numeric
    )
    on conflict (slug) do update set
      name = excluded.name,
      destination_slug = excluded.destination_slug,
      destination_name = excluded.destination_name,
      city = coalesce(excluded.city, rate_hotels.city),
      country = coalesce(excluded.country, rate_hotels.country),
      star_rating = coalesce(excluded.star_rating, rate_hotels.star_rating),
      active = true;
  end loop;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    select id into v_hotel_id from rate_hotels where slug = v_row->>'hotel_slug';
    if v_hotel_id is null then
      raise exception 'Rate row references unknown hotel slug %', v_row->>'hotel_slug';
    end if;

    insert into hotel_rate_rows (
      document_id, hotel_id, extraction_key, rate_type, season_name,
      valid_from, valid_to, booking_by, blackout_dates, room_type, meal_plan,
      occupancy, adults, children, amount, currency, market, unit_basis,
      minimum_stay, tax_included, commission_included, child_policy,
      cancellation_policy, payment_terms, conditions, source_page,
      ai_confidence, validation_errors
    ) values (
      p_document_id,
      v_hotel_id,
      v_row->>'extraction_key',
      v_row->>'rate_type',
      nullif(v_row->>'season_name', ''),
      (v_row->>'valid_from')::date,
      (v_row->>'valid_to')::date,
      nullif(v_row->>'booking_by', '')::date,
      coalesce(array(select jsonb_array_elements_text(v_row->'blackout_dates')), '{}'),
      v_row->>'room_type',
      v_row->>'meal_plan',
      v_row->>'occupancy',
      nullif(v_row->>'adults', '')::int,
      nullif(v_row->>'children', '')::int,
      (v_row->>'amount')::numeric,
      upper(v_row->>'currency'),
      v_row->>'market',
      v_row->>'unit_basis',
      nullif(v_row->>'minimum_stay', '')::int,
      coalesce(nullif(v_row->>'tax_included', ''), 'Unknown'),
      coalesce(nullif(v_row->>'commission_included', ''), 'Unknown'),
      nullif(v_row->>'child_policy', ''),
      nullif(v_row->>'cancellation_policy', ''),
      nullif(v_row->>'payment_terms', ''),
      nullif(v_row->>'conditions', ''),
      nullif(v_row->>'source_page', '')::int,
      coalesce(nullif(v_row->>'ai_confidence', ''), 'Low'),
      coalesce(array(select jsonb_array_elements_text(v_row->'validation_errors')), '{}')
    );
  end loop;

  update rate_documents set
    supplier_name = nullif(p_document->>'supplier_name', ''),
    contract_name = nullif(p_document->>'contract_name', ''),
    document_type = nullif(p_document->>'document_type', ''),
    pricing_basis = coalesce(nullif(p_document->>'pricing_basis', ''), 'unknown')::rate_pricing_basis,
    default_market = nullif(p_document->>'default_market', ''),
    default_currency = nullif(upper(p_document->>'default_currency'), ''),
    status = 'review',
    extraction_model = p_model,
    hotel_count = jsonb_array_length(p_hotels),
    valid_rate_rows = jsonb_array_length(p_rows),
    invalid_rate_rows = coalesce((p_document->>'invalid_rate_rows')::int, 0),
    warnings = coalesce(p_warnings, '[]'::jsonb),
    summary = nullif(p_document->>'summary', ''),
    ai_confidence = nullif(p_document->>'confidence', ''),
    extraction_payload = p_payload,
    error_message = null,
    extracted_at = now()
  where id = p_document_id;
end;
$$;

revoke all on function replace_rate_extraction(uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function replace_rate_extraction(uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb)
  to service_role;

-- Publish every non-rejected row in a reviewed document. Existing active rows
-- for the same commercial identity and overlapping dates are retired first.
create or replace function publish_rate_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_basis rate_pricing_basis;
  v_status rate_document_status;
  v_publishable int;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  select pricing_basis, status into v_basis, v_status
  from rate_documents
  where id = p_document_id
  for update;

  if v_status <> 'review' then
    raise exception 'Only reviewed documents can be published';
  end if;
  if v_basis = 'unknown' then
    raise exception 'Choose rack or net pricing before publishing';
  end if;

  select count(*) into v_publishable
  from hotel_rate_rows
  where document_id = p_document_id
    and review_status <> 'rejected'
    and cardinality(validation_errors) = 0;

  if v_publishable = 0 then
    raise exception 'The document has no valid rate rows to publish';
  end if;

  update hotel_rate_rows old_row set
    active = false,
    updated_at = now()
  where old_row.active = true
    and old_row.document_id <> p_document_id
    and exists (
      select 1
      from hotel_rate_rows new_row
      where new_row.document_id = p_document_id
        and new_row.review_status <> 'rejected'
        and cardinality(new_row.validation_errors) = 0
        and new_row.hotel_id = old_row.hotel_id
        and lower(new_row.market) = lower(old_row.market)
        and lower(new_row.room_type) = lower(old_row.room_type)
        and lower(new_row.meal_plan) = lower(old_row.meal_plan)
        and lower(new_row.occupancy) = lower(old_row.occupancy)
        and daterange(new_row.valid_from, new_row.valid_to, '[]')
            && daterange(old_row.valid_from, old_row.valid_to, '[]')
    );

  update hotel_rate_rows set
    review_status = 'approved',
    active = true,
    approved_by = auth.uid(),
    approved_at = now()
  where document_id = p_document_id
    and review_status <> 'rejected'
    and cardinality(validation_errors) = 0;

  update hotel_rate_rows set active = false
  where document_id = p_document_id
    and (review_status = 'rejected' or cardinality(validation_errors) > 0);

  update rate_documents set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    approved_at = now(),
    error_message = null
  where id = p_document_id;
end;
$$;

revoke all on function publish_rate_document(uuid) from public, anon;
grant execute on function publish_rate_document(uuid) to authenticated;

create or replace function reject_rate_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  update hotel_rate_rows set review_status = 'rejected', active = false
  where document_id = p_document_id;

  update rate_documents set
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_document_id and status <> 'approved';

  if not found then
    raise exception 'Document cannot be rejected';
  end if;
end;
$$;

revoke all on function reject_rate_document(uuid) from public, anon;
grant execute on function reject_rate_document(uuid) to authenticated;
