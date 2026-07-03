-- =============================================================================
-- Row Level Security — authenticated staff only.
--
-- First release keeps authorisation simple (the prompt asks not to build
-- complex permissions): any authenticated, active staff member can read the
-- shared business data; admins additionally manage the users table. Tighten
-- to per-consultant ownership later by swapping the `using` clauses for
-- `assigned_consultant_id = auth.uid()` style checks.
-- =============================================================================

-- Helper: is the caller an active staff member?
create or replace function is_staff() returns boolean as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.active = true
  );
$$ language sql stable security definer;

-- Helper: is the caller an administrator?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and u.active = true
  );
$$ language sql stable security definer;

-- Enable RLS on every table.
alter table users             enable row level security;
alter table customers         enable row level security;
alter table enquiries         enable row level security;
alter table quotations        enable row level security;
alter table quotation_options enable row level security;
alter table quotation_items   enable row level security;
alter table bookings          enable row level security;
alter table payments          enable row level security;
alter table tasks             enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;
alter table documents         enable row level security;
alter table activity_logs     enable row level security;

-- Users: everyone signed-in can read the staff directory; admins manage it;
-- a user can update their own profile row.
create policy users_read   on users for select using (is_staff());
create policy users_admin  on users for all    using (is_admin()) with check (is_admin());
create policy users_self   on users for update using (id = auth.uid()) with check (id = auth.uid());

-- Shared operational tables: any active staff member has full access.
-- (Apply the same four policies to each business table.)
do $$
declare t text;
begin
  foreach t in array array[
    'customers','enquiries','quotations','quotation_options','quotation_items',
    'bookings','payments','tasks','conversations','messages','documents','activity_logs'
  ] loop
    execute format('create policy %I_staff_all on %I for all using (is_staff()) with check (is_staff());', t, t);
  end loop;
end $$;

-- NOTE: the service-role key used by the WhatsApp webhook bypasses RLS by
-- design (server-only). Never expose it to the browser.
