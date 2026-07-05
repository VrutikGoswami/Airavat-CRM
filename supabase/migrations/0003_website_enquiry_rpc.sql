-- Transactional intake endpoint for public website enquiries.
-- Call through Supabase RPC as `create_website_enquiry`.

create or replace function create_website_enquiry(
  p_reference text,
  p_customer jsonb,
  p_enquiry jsonb,
  p_source jsonb default '{}'::jsonb
)
returns table(reference text, customer_id uuid, enquiry_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_consultant_id uuid;
  v_enquiry_id uuid;
  v_phone text := nullif(p_customer->>'whatsapp', '');
  v_email text := nullif(p_customer->>'email', '');
  v_customer_type customer_type := coalesce(nullif(p_customer->>'type', ''), 'individual')::customer_type;
begin
  if p_reference is null or length(trim(p_reference)) = 0 then
    raise exception 'Reference is required';
  end if;

  if v_phone is null then
    raise exception 'WhatsApp number is required';
  end if;

  select id
    into v_consultant_id
    from users
   where active = true and role = 'consultant'
   order by (
     select count(*)
       from enquiries e
      where e.assigned_consultant_id = users.id
        and e.status = 'open'
   ), created_at
   limit 1;

  select id
    into v_customer_id
    from customers
   where whatsapp = v_phone
      or (v_email is not null and email = v_email)
   order by updated_at desc
   limit 1;

  if v_customer_id is null then
    insert into customers (
      name,
      whatsapp,
      email,
      type,
      preferred_contact,
      assigned_consultant_id,
      company,
      preferences
    )
    values (
      p_customer->>'name',
      v_phone,
      v_email,
      v_customer_type,
      coalesce(nullif(p_customer->>'preferred_contact', ''), 'whatsapp')::contact_method,
      v_consultant_id,
      nullif(p_customer->>'company', ''),
      nullif(p_customer->>'preferences', '')
    )
    returning id into v_customer_id;
  else
    update customers
       set name = coalesce(nullif(p_customer->>'name', ''), name),
           whatsapp = v_phone,
           email = coalesce(v_email, email),
           preferred_contact = coalesce(nullif(p_customer->>'preferred_contact', ''), preferred_contact::text)::contact_method,
           assigned_consultant_id = coalesce(assigned_consultant_id, v_consultant_id),
           company = coalesce(nullif(p_customer->>'company', ''), company),
           preferences = coalesce(nullif(p_customer->>'preferences', ''), preferences)
     where id = v_customer_id;
  end if;

  insert into enquiries (
    ref,
    customer_id,
    service,
    origin,
    destination,
    travel_start_date,
    travel_end_date,
    dates_flexible,
    adults,
    children,
    infants,
    budget,
    requirements,
    lead_source,
    assigned_consultant_id,
    stage,
    waiting_on,
    next_action_label,
    next_action_date,
    status
  )
  values (
    p_reference,
    v_customer_id,
    (p_enquiry->>'service')::service_type,
    nullif(p_enquiry->>'origin', ''),
    p_enquiry->>'destination',
    nullif(p_enquiry->>'departure_date', '')::date,
    nullif(p_enquiry->>'return_date', '')::date,
    coalesce((p_enquiry->>'flexible_dates')::boolean, false),
    coalesce((p_enquiry->>'adults')::int, 1),
    coalesce((p_enquiry->>'children')::int, 0),
    coalesce((p_enquiry->>'infants')::int, 0),
    nullif(p_enquiry->>'budget', ''),
    jsonb_pretty(
      jsonb_strip_nulls(
        p_enquiry
        || jsonb_build_object('source', p_source)
      )
    ),
    'website',
    v_consultant_id,
    'new',
    'team',
    'Review website enquiry',
    current_date + 1,
    'open'
  )
  returning id into v_enquiry_id;

  insert into tasks (
    title,
    type,
    customer_id,
    enquiry_id,
    assigned_to_id,
    due_at,
    priority
  )
  values (
    'Follow up website enquiry ' || p_reference,
    'follow-up-call',
    v_customer_id,
    v_enquiry_id,
    v_consultant_id,
    now() + interval '1 day',
    'medium'
  );

  insert into activity_logs (kind, summary, customer_id, enquiry_id)
  values (
    'website-enquiry',
    'Website enquiry ' || p_reference || ' received',
    v_customer_id,
    v_enquiry_id
  );

  return query select p_reference, v_customer_id, v_enquiry_id;
end;
$$;
