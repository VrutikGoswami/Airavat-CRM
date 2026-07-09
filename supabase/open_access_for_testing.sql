-- TEMPORARY TESTING ONLY.
--
-- This opens the CRM tables to the public anon key so the browser-based CRM can
-- read and write while auth is disabled. Do not leave this enabled in
-- production with real customer data.

grant usage on schema public to anon;

grant select, insert, update, delete on table
  public.users,
  public.customers,
  public.enquiries,
  public.quotations,
  public.quotation_options,
  public.quotation_items,
  public.suppliers,
  public.bookings,
  public.payments,
  public.tasks,
  public.conversations,
  public.messages,
  public.documents,
  public.activity_logs
to anon;

grant select on public.booking_balances to anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users',
    'customers',
    'enquiries',
    'quotations',
    'quotation_options',
    'quotation_items',
    'suppliers',
    'bookings',
    'payments',
    'tasks',
    'conversations',
    'messages',
    'documents',
    'activity_logs'
  ] loop
    execute format('drop policy if exists anon_open_testing on public.%I', table_name);
    execute format(
      'create policy anon_open_testing on public.%I for all to anon using (true) with check (true)',
      table_name
    );
  end loop;
end $$;

-- Rollback when you are ready to restore staff-only access:
--
-- do $$
-- declare
--   table_name text;
-- begin
--   foreach table_name in array array[
--     'users','customers','enquiries','quotations','quotation_options',
--     'quotation_items','suppliers','bookings','payments','tasks',
--     'conversations','messages','documents','activity_logs'
--   ] loop
--     execute format('drop policy if exists anon_open_testing on public.%I', table_name);
--   end loop;
-- end $$;
--
-- revoke select, insert, update, delete on table
--   public.users,
--   public.customers,
--   public.enquiries,
--   public.quotations,
--   public.quotation_options,
--   public.quotation_items,
--   public.suppliers,
--   public.bookings,
--   public.payments,
--   public.tasks,
--   public.conversations,
--   public.messages,
--   public.documents,
--   public.activity_logs
-- from anon;
--
-- revoke select on public.booking_balances from anon;
