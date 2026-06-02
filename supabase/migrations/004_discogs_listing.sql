alter table albums
  add column if not exists discogs_listing_id text,
  add column if not exists discogs_listing_url text,
  add column if not exists discogs_release_id bigint;
