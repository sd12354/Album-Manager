-- Deduplicate any existing (album_id, source) rows, keeping the most recent.
delete from pricing_cache
where id not in (
  select distinct on (album_id, source) id
  from pricing_cache
  order by album_id, source, fetched_at desc
);

-- Enforce one cache row per album+source so upserts work cleanly.
alter table pricing_cache
  add constraint pricing_cache_album_source_uniq unique (album_id, source);
