alter table public.rate_hotels
  add column if not exists area text,
  add column if not exists short_description text,
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists amenities text[] not null default '{}';

comment on column public.rate_hotels.area is 'Staff-maintained neighbourhood or locality shown in Hotel Finder.';
comment on column public.rate_hotels.short_description is 'Short staff-maintained property summary for Hotel Finder.';
comment on column public.rate_hotels.image_urls is 'Ordered property image URLs maintained by staff.';
comment on column public.rate_hotels.amenities is 'Short amenity labels maintained by staff.';
