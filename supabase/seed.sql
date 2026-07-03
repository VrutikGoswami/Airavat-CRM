-- =============================================================================
-- Airavat CRM — demonstration seed data (fictional).
--
-- Run AFTER 0001_schema.sql and 0002_rls.sql.
--
-- Staff (`users`) reference auth.users, so create your team through Supabase
-- Auth first, then insert matching rows into `public.users`. Example:
--
--   insert into public.users (id, name, email, role) values
--     ('<auth-uid-1>', 'Amina Wanjiru', 'amina@airavat.example', 'admin'),
--     ('<auth-uid-2>', 'Daniel Otieno', 'daniel@airavat.example', 'consultant'),
--     ('<auth-uid-3>', 'Grace Mwangi',  'grace@airavat.example',  'consultant');
--
-- The business rows below use NULL for consultant references so the seed runs
-- without staff present. Once your users exist, UPDATE the assigned_* columns.
-- The full, richer dataset ships in the app's demo mode (lib/seed.ts).
-- =============================================================================

insert into customers (id, name, whatsapp, email, type, preferred_contact, preferences, previous_destinations) values
  ('11111111-1111-1111-1111-111111111101', 'Lukas Müller',        '+49 151 2345678',  'lukas.muller@example.de',           'individual', 'whatsapp', 'Photographer, prefers fly-in and quieter conservancies.', '{}'),
  ('11111111-1111-1111-1111-111111111102', 'Savannah Freight Ltd','+254 722 100200',  'travel@savannahfreight.example',    'corporate',  'email',    'Business class where budget allows; consolidated invoicing.', array['Dubai','Guangzhou']),
  ('11111111-1111-1111-1111-111111111103', 'Peter Kimani',        '+254 733 445566',  'pkimani@example.com',               'family',     'whatsapp', 'Two children (7, 10); family rooms, short drives.', array['Naivasha']),
  ('11111111-1111-1111-1111-111111111104', 'Emma De Vos',         '+32 470 12 34 56', 'emma.devos@example.be',             'family',     'whatsapp', 'First family safari; gentle pace, family camp.', '{}');

insert into enquiries (id, ref, customer_id, service, origin, destination, travel_start_date, travel_end_date, adults, children, budget, requirements, lead_source, stage, waiting_on, next_action_label, estimated_value, status) values
  ('22222222-2222-2222-2222-222222222201', 'ENQ-9C4NB', '11111111-1111-1111-1111-111111111101', 'safari',          'Nairobi (Wilson)', 'Maasai Mara',     current_date + 33, current_date + 37, 2, 0, 'USD 3,000 – 4,500', 'Fly-in migration safari, 4 nights, conservancy.', 'website',  'awaiting-customer',    'customer', 'Chase decision on options',      480000, 'open'),
  ('22222222-2222-2222-2222-222222222202', 'ENQ-2K6HD', '11111111-1111-1111-1111-111111111102', 'corporate',       'Nairobi (NBO)',    'Dubai (DXB)',     current_date + 21, current_date + 26, 3, 0, 'USD 4,500 – 6,000', 'Three staff, business class, one booking.',       'email',    'quotation-sent',       'customer', 'Follow up sent quotation',       720000, 'open'),
  ('22222222-2222-2222-2222-222222222203', 'ENQ-5T9RW', '11111111-1111-1111-1111-111111111103', 'holiday-package', 'Nairobi',          'Nairobi · Mara · Diani', current_date + 70, current_date + 78, 2, 2, 'KES 450k – 600k', 'Family holiday, safari then coast.',              'referral', 'quotation-in-progress','team',     'Finish package quotation',       540000, 'open'),
  ('22222222-2222-2222-2222-222222222204', 'ENQ-6D3PA', '11111111-1111-1111-1111-111111111104', 'holiday-package', 'Brussels (BRU)',   'Nairobi · Maasai Mara', current_date + 40, current_date + 48, 2, 2, 'EUR 7,000', 'First family safari, confirmed & booked.',        'website',  'confirmed',            'none',     'Send final documents',           910000, 'open');

-- Quotation for the De Vos family (accepted → booking below)
insert into quotations (id, ref, customer_id, enquiry_id, destination, travel_start_date, travel_end_date, adults, children, currency, valid_until, status, deposit_pct, exclusions, terms, selected_option_label, share_token) values
  ('33333333-3333-3333-3333-333333333301', 'QUO-1039', '11111111-1111-1111-1111-111111111104', '22222222-2222-2222-2222-222222222204', 'Nairobi · Maasai Mara', current_date + 40, current_date + 48, 2, 2, 'EUR', current_date - 5, 'accepted', 30, array['International flights','Travel insurance','Tips'], 'A 30% deposit confirms the booking; balance due 21 days before travel.', 'B', 'devos-6d3pa-demo');

insert into quotation_options (id, quotation_id, label, name, note) values
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', 'A', 'Road safari · family lodge', 'Budget-friendly, larger lodge.'),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', 'B', 'Fly-in · family camp', 'Chosen option — gentle pace, family tents.');

insert into quotation_items (option_id, type, supplier, description, quantity, cost_price, markup_pct, selling_price, tax_pct) values
  ('44444444-4444-4444-4444-444444444402', 'flight', 'Safarilink',            'Wilson ⇄ Mara light aircraft, family of four', 4, 310, 12, 347, 0),
  ('44444444-4444-4444-4444-444444444402', 'hotel',  'Mara Simba Family Camp','3 nights full board, family tents, game drives', 4, 720, 15, 828, 0),
  ('44444444-4444-4444-4444-444444444402', 'hotel',  'Nairobi Serena',        '2 nights B&B, family room, Nairobi', 2, 190, 18, 224, 0),
  ('44444444-4444-4444-4444-444444444402', 'transfer','Airavat',              'All airport & city transfers', 4, 60, 20, 72, 0);

insert into bookings (id, ref, customer_id, quotation_id, enquiry_id, destination, travel_start_date, travel_end_date, adults, children, services_summary, amadeus_pnr, hotel_refs, transport_ref, total_selling, total_cost, amount_paid, status) values
  ('55555555-5555-5555-5555-555555555501', 'BKG-508', '11111111-1111-1111-1111-111111111104', '33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222204', 'Nairobi · Maasai Mara', current_date + 40, current_date + 48, 2, 2, array['2 nights Nairobi','3 nights Mara family camp','Return light aircraft','All transfers'], 'KQ7X2M', 'MSC-22841 / SER-55190', 'AV-TRF-3391', 910000, 726000, 273000, 'fully-confirmed');

insert into payments (booking_id, amount, method, reference) values
  ('55555555-5555-5555-5555-555555555501', 273000, 'bank-transfer', 'TRF-DEVOS-01');

insert into tasks (title, type, customer_id, enquiry_id, due_at, priority, done) values
  ('Call Lukas about the fly-in option', 'follow-up-call', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', now() + interval '2 hours', 'high', false),
  ('Finish and send Kimani family package', 'send-quotation', '11111111-1111-1111-1111-111111111103', '22222222-2222-2222-2222-222222222203', now() + interval '6 hours', 'medium', false);

insert into conversations (id, customer_id, phone, display_name, enquiry_id, unread_count, window_expires_at) values
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111101', '+49 151 2345678', 'Lukas Müller', '22222222-2222-2222-2222-222222222201', 2, now() + interval '20 hours');

insert into messages (conversation_id, direction, body, status) values
  ('66666666-6666-6666-6666-666666666601', 'out', 'Hi Lukas, I''ve sent three options for your Mara safari.', 'read'),
  ('66666666-6666-6666-6666-666666666601', 'in',  'Thanks! The fly-in conservancy option looks great. Can we add a night?', 'received');
