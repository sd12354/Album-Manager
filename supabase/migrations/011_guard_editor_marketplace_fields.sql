-- Shared editors can maintain catalogue data, but marketplace, sale, price,
-- and fulfillment state belongs to the collection owner. Enforce that at the
-- database layer so direct Supabase client updates cannot bypass the UI/API.
create or replace function public.prevent_editor_marketplace_field_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Server-side maintenance with the service role has no auth.uid(); RLS keeps
  -- anonymous clients from reaching this path, while trusted jobs may need it.
  if auth.uid() is null or auth.uid() = old.user_id then
    return new;
  end if;

  if
    new.status is distinct from old.status or
    new.list_price is distinct from old.list_price or
    new.ebay_listing_id is distinct from old.ebay_listing_id or
    new.ebay_listing_url is distinct from old.ebay_listing_url or
    new.discogs_listing_id is distinct from old.discogs_listing_id or
    new.discogs_listing_url is distinct from old.discogs_listing_url or
    new.sold_price is distinct from old.sold_price or
    new.sold_at is distinct from old.sold_at or
    new.tracking_number is distinct from old.tracking_number or
    new.shipping_label_url is distinct from old.shipping_label_url or
    new.shipping_carrier is distinct from old.shipping_carrier or
    new.shipping_rate is distinct from old.shipping_rate or
    new.buyer_name is distinct from old.buyer_name or
    new.buyer_address_raw is distinct from old.buyer_address_raw
  then
    raise exception 'only the collection owner can change marketplace, sale, or fulfillment fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_editor_marketplace_field_change on public.albums;

create trigger prevent_editor_marketplace_field_change
before update of
  status,
  list_price,
  ebay_listing_id,
  ebay_listing_url,
  discogs_listing_id,
  discogs_listing_url,
  sold_price,
  sold_at,
  tracking_number,
  shipping_label_url,
  shipping_carrier,
  shipping_rate,
  buyer_name,
  buyer_address_raw
on public.albums
for each row
execute function public.prevent_editor_marketplace_field_change();

revoke all on function public.prevent_editor_marketplace_field_change() from public;
