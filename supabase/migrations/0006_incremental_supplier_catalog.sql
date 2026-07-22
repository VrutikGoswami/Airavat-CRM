-- Preserve source provenance for batch imports and make repeated supplier
-- updates safe when currencies or rate units overlap.

alter table public.rate_documents
  add column if not exists source_relative_path text,
  add column if not exists ingestion_batch text;

create index if not exists rate_documents_ingestion_batch_idx
  on public.rate_documents (ingestion_batch, uploaded_at desc)
  where ingestion_batch is not null;

alter table public.rate_hotels
  add column if not exists hotel_group text,
  add column if not exists website_url text;

comment on column public.rate_documents.source_relative_path is
  'Original path within an imported supplier archive. Never exposed publicly.';
comment on column public.rate_documents.ingestion_batch is
  'Stable label used to audit a repeatable group import.';
comment on column public.rate_hotels.hotel_group is
  'Optional hotel collection or operating group shown in catalog results.';
comment on column public.rate_hotels.website_url is
  'Optional public hotel website URL maintained by staff.';

create index if not exists hotel_rate_rows_published_search_idx
  on public.hotel_rate_rows (valid_from, valid_to, hotel_id)
  where active = true and review_status = 'approved';

-- Authentication is disabled in the testing CRM, so the server-side service
-- role needs a narrowly scoped publication function. This keeps overlap
-- retirement atomic and unavailable to anon/authenticated clients.
create or replace function public.publish_rate_document_service(
  p_document_id uuid,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_basis public.rate_pricing_basis;
  v_status public.rate_document_status;
  v_publishable int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role access is required';
  end if;

  select pricing_basis, status into v_basis, v_status
  from public.rate_documents
  where id = p_document_id
  for update;

  if v_status <> 'review' then
    raise exception 'Only reviewed documents can be published';
  end if;
  if v_basis = 'unknown' then
    raise exception 'Choose rack or net pricing before publishing';
  end if;

  select count(*) into v_publishable
  from public.hotel_rate_rows
  where document_id = p_document_id
    and review_status <> 'rejected'
    and cardinality(validation_errors) = 0;

  if v_publishable = 0 then
    raise exception 'The document has no valid rate rows to publish';
  end if;

  update public.hotel_rate_rows old_row set
    active = false,
    updated_at = now()
  where old_row.active = true
    and old_row.document_id <> p_document_id
    and exists (
      select 1
      from public.hotel_rate_rows new_row
      where new_row.document_id = p_document_id
        and new_row.review_status <> 'rejected'
        and cardinality(new_row.validation_errors) = 0
        and new_row.hotel_id = old_row.hotel_id
        and lower(new_row.rate_type) = lower(old_row.rate_type)
        and lower(new_row.market) = lower(old_row.market)
        and lower(new_row.room_type) = lower(old_row.room_type)
        and lower(new_row.meal_plan) = lower(old_row.meal_plan)
        and lower(new_row.occupancy) = lower(old_row.occupancy)
        and lower(new_row.unit_basis) = lower(old_row.unit_basis)
        and new_row.currency = old_row.currency
        and daterange(new_row.valid_from, new_row.valid_to, '[]')
            && daterange(old_row.valid_from, old_row.valid_to, '[]')
    );

  update public.hotel_rate_rows set
    review_status = 'approved',
    active = true,
    approved_by = p_actor_id,
    approved_at = now()
  where document_id = p_document_id
    and review_status <> 'rejected'
    and cardinality(validation_errors) = 0;

  update public.hotel_rate_rows set active = false
  where document_id = p_document_id
    and (review_status = 'rejected' or cardinality(validation_errors) > 0);

  update public.rate_documents set
    status = 'approved',
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    approved_at = now(),
    error_message = null
  where id = p_document_id;
end;
$$;

revoke all on function public.publish_rate_document_service(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_rate_document_service(uuid, uuid)
  to service_role;
