-- Albums table
create table albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  artist text not null,
  genre text,
  condition text check (condition in ('Mint', 'Great', 'Good', 'Fair', 'Poor')),
  catalog_number text,
  notes text,
  purchase_price numeric(10,2),
  suggested_price numeric(10,2),
  list_price numeric(10,2),
  status text default 'unlisted' check (status in ('unlisted','pricing','listed','sold')),
  ebay_listing_id text,
  ebay_listing_url text,
  sold_price numeric(10,2),
  sold_at timestamptz,
  photo_urls text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table albums enable row level security;

create policy "Users own albums" on albums for all using (auth.uid() = user_id);

-- Pricing cache
create table pricing_cache (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references albums on delete cascade,
  source text check (source in ('discogs','ebay')),
  median_price numeric(10,2),
  lowest_price numeric(10,2),
  num_sales int,
  raw_data jsonb,
  fetched_at timestamptz default now()
);

alter table pricing_cache enable row level security;

create policy "Users own cache" on pricing_cache for all
  using (auth.uid() = (select user_id from albums where id = album_id));

-- eBay credentials
create table ebay_credentials (
  user_id uuid primary key references auth.users,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  updated_at timestamptz default now()
);

alter table ebay_credentials enable row level security;

create policy "Users own credentials" on ebay_credentials for all using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger albums_updated_at
  before update on albums
  for each row
  execute function handle_updated_at();

-- Storage bucket for album photos
insert into storage.buckets (id, name, public)
values ('album-photos', 'album-photos', false)
on conflict (id) do nothing;

create policy "Users can upload own photos"
on storage.objects for insert
with check (
  bucket_id = 'album-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view own photos"
on storage.objects for select
using (
  bucket_id = 'album-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete own photos"
on storage.objects for delete
using (
  bucket_id = 'album-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
